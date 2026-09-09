import type { AIProvider } from '@/ai/provider';
import { followupRepository, leadRepository, taskRepository } from '@/repositories/supabase';
import type { Agent, AgentResult } from './types';

/** Follow-up Agent (spec §37, ACTIVE): overdue detection, tasks, drafts. */
export const followupAgent: Agent = {
  name: 'followup',
  taskType: 'followup',
  description: 'Overdue follow-up detection, prioritization, task creation and draft messages.',

  async handle(command: string, user, provider: AIProvider): Promise<AgentResult> {
    const lower = command.toLowerCase();
    const wantsTask = lower.includes('create') && (lower.includes('task') || lower.includes('follow-up') || lower.includes('followup'));

    const overdue = await followupRepository.list({ status: 'overdue', limit: 25 });
    const pending = await followupRepository.list({ status: 'pending', limit: 25 });
    const now = new Date();
    const dueTodayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dueTodayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const today = await followupRepository.list({ status: 'pending', scheduledFrom: dueTodayStart, scheduledTo: dueTodayEnd, limit: 25 });

    const leadIds = [...new Set([...overdue, ...today].map((f) => f.lead_id).filter((id): id is string => Boolean(id)))];
    const leadNames = new Map<string, string>();
    for (const id of leadIds.slice(0, 20)) {
      const lead = await leadRepository.getById(id);
      if (lead) leadNames.set(id, lead.company);
    }

    const createdTasks: string[] = [];
    if (wantsTask && overdue.length > 0) {
      const top = overdue[0];
      const task = await taskRepository.create({
        title: `Overdue follow-up: ${leadNames.get(top.lead_id ?? '') ?? 'record'} (${top.followup_type})`,
        description: 'Created by the Follow-up Agent from an overdue follow-up. Internal action only.',
        priority: top.priority === 'low' ? 'medium' : top.priority,
        status: 'todo',
        assigned_to: top.assigned_to ?? user.appUser.id,
        lead_id: top.lead_id,
        due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      createdTasks.push(task.id);
    }

    let draft: string | null = null;
    if (lower.includes('draft') && overdue[0]?.lead_id) {
      const lead = await leadRepository.getById(overdue[0].lead_id!);
      if (lead) {
        draft = await provider.generateText(
          `Draft a short, polite follow-up message to ${lead.contact_name ?? 'the contact'} at ${lead.company} about: ${lead.requirement ?? 'their enquiry'}. Reference that we are following up as promised.`,
          { system: 'You draft concise B2B medical-equipment sales follow-ups. Never invent prices, certifications, or product claims.' },
        );
        await followupRepository.update(overdue[0].id, { draft_content: draft });
      }
    }

    return {
      summary: `${overdue.length} overdue, ${today.length} due today, ${pending.length} total pending follow-ups.`,
      data: {
        overdue: overdue.map((f) => ({ id: f.id, lead: f.lead_id ? leadNames.get(f.lead_id) ?? f.lead_id : null, scheduled_at: f.scheduled_at, priority: f.priority })),
        due_today: today.map((f) => ({ id: f.id, lead: f.lead_id ? leadNames.get(f.lead_id) ?? f.lead_id : null, scheduled_at: f.scheduled_at })),
        created_task_ids: createdTasks,
        draft: draft ? { marked: 'AI Draft', content: draft } : null,
      },
      recommended_actions: [
        ...(overdue.length ? [`Contact the ${overdue.length} overdue follow-up(s) first.`] : []),
        ...(draft ? ['Review the AI draft before any external use (DRAFT_ONLY mode).'] : []),
        ...(overdue.length === 0 && today.length === 0 ? ['No follow-up action needed today.'] : []),
      ],
      approval_required: false,
    };
  },
};
