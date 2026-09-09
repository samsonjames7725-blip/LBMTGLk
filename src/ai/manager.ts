import { z } from 'zod';
import type { SessionUser } from '@/auth/session';
import { classifyByKeyword, getAIProvider } from './provider';
import { agentRunRepository } from '@/repositories/supabase';
import { recordAudit, AUDIT_ACTIONS } from '@/services/audit-service';
import { ForbiddenError } from '@/security/http';
import type { Permission } from '@/auth/permissions';
import type { AgentTaskType } from '@/types/database';
import { leadAgent } from './agents/lead-agent';
import { salesAgent } from './agents/sales-agent';
import { followupAgent } from './agents/followup-agent';
import { emailAgent } from './agents/email-agent';
import type { Agent } from './agents/types';

export const ACTIVE_AGENTS: Agent[] = [leadAgent, salesAgent, followupAgent, emailAgent];

/** Registry surfaced by /api/agents and the Agents page (spec §57). */
export const AGENT_REGISTRY: {
  name: string;
  status: 'ACTIVE' | 'ACTIVE / DRAFT ONLY' | 'NOT IMPLEMENTED';
  description: string;
}[] = [
  { name: 'manager', status: 'ACTIVE', description: 'Interprets commands, routes tasks, coordinates agents, enforces authorization and approvals.' },
  { name: 'lead', status: 'ACTIVE', description: 'Qualification, scoring, prioritization, requirement analysis.' },
  { name: 'sales', status: 'ACTIVE', description: 'Pipeline analysis, opportunity prioritization, next-action suggestions.' },
  { name: 'followup', status: 'ACTIVE', description: 'Overdue follow-ups, prioritization, task creation, draft messages.' },
  { name: 'email', status: 'ACTIVE / DRAFT ONLY', description: 'Email drafting and personalization. No autonomous external sending.' },
  { name: 'marketing', status: 'NOT IMPLEMENTED', description: 'Planned: campaign architecture and content planning.' },
  { name: 'seo', status: 'NOT IMPLEMENTED', description: 'Planned: search visibility and content optimization.' },
  { name: 'proposal', status: 'NOT IMPLEMENTED', description: 'Planned: full proposal document generation.' },
  { name: 'tender_rfp', status: 'NOT IMPLEMENTED', description: 'Planned: tender/RFP response support.' },
  { name: 'sop', status: 'NOT IMPLEMENTED', description: 'Planned: SOP drafting from approved knowledge.' },
  { name: 'procurement', status: 'NOT IMPLEMENTED', description: 'Planned: vendor and procurement support.' },
  { name: 'customer_success', status: 'NOT IMPLEMENTED', description: 'Planned: customer health and reactivation.' },
  { name: 'service', status: 'NOT IMPLEMENTED', description: 'Planned: service ticket triage.' },
  { name: 'website', status: 'NOT IMPLEMENTED', description: 'Planned: website content preparation (requires approval).' },
];

const TASK_TYPES = ['lead', 'sales', 'followup', 'email', 'proposal', 'analytics', 'report', 'customer_success', 'unknown'] as const;

const PERMISSION_FOR_TASK: Record<(typeof TASK_TYPES)[number], Permission> = {
  lead: 'crm.read',
  sales: 'crm.read',
  followup: 'crm.read',
  email: 'approvals.request',
  proposal: 'approvals.request',
  analytics: 'analytics.read',
  report: 'analytics.read',
  customer_success: 'crm.read',
  unknown: 'crm.read',
};

export interface AICommandResponse {
  command: string;
  agent: string;
  status: 'completed' | 'failed';
  result: Record<string, unknown>;
  recommended_actions: string[];
  approval_required: boolean;
  approval_id?: string | null;
  provider: { name: string; configured: boolean; model: string };
}

/** Deterministic keyword classifier — used before any AI provider call. */
export function classifyIntentByKeyword(command: string): AgentTaskType {
  return classifyByKeyword(command, TASK_TYPES) as AgentTaskType;
}

/**
 * AI Manager (spec §29/§30): intent classification → permission check →
 * agent selection → execution → agent run record → audit → structured
 * response. The AI can never grant itself permissions or bypass approvals.
 */
export async function runAICommand(command: string, user: SessionUser): Promise<AICommandResponse> {
  const provider = getAIProvider();
  const taskType = classifyIntentByKeyword(command);
  const agent = ACTIVE_AGENTS.find((a) => a.taskType === taskType);

  const run = await agentRunRepository.start({
    agentName: agent?.name ?? 'manager',
    taskType,
    userId: user.appUser.id,
    input: { command },
    approvalRequired: false,
  });

  try {
    const requiredPermission = PERMISSION_FOR_TASK[taskType];
    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenError(`The ${taskType} agent requires the "${requiredPermission}" permission.`);
    }

    if (!agent) {
      // Valid intent, but no active agent implemented for it yet (spec §40).
      const response: AICommandResponse = {
        command,
        agent: 'manager',
        status: 'completed',
        result: {
          message: `The ${taskType} capability exists in the architecture but is not implemented yet.`,
          task_type: taskType,
        },
        recommended_actions: [],
        approval_required: false,
        provider: { name: provider.name, configured: provider.configured, model: provider.model },
      };
      await agentRunRepository.complete(run.id, response.result);
      await recordAudit({ actor: user.appUser.id, action: AUDIT_ACTIONS.aiExecution, entity: 'agent_run', entity_id: run.id, metadata: { task_type: taskType, agent: 'manager' } });
      return response;
    }

    const result = await agent.handle(command, user, provider);
    await agentRunRepository.complete(run.id, { summary: result.summary, data: result.data }, result.approval_id ?? null);
    await recordAudit({
      actor: user.appUser.id,
      action: AUDIT_ACTIONS.aiExecution,
      entity: 'agent_run',
      entity_id: run.id,
      metadata: { agent: agent.name, task_type: taskType },
    });

    return {
      command,
      agent: agent.name,
      status: 'completed',
      result: { summary: result.summary, ...result.data },
      recommended_actions: result.recommended_actions,
      approval_required: result.approval_required,
      approval_id: result.approval_id ?? null,
      provider: { name: provider.name, configured: provider.configured, model: provider.model },
    };
  } catch (error) {
    await agentRunRepository.fail(run.id, error instanceof Error ? error.name : 'UNKNOWN');
    await recordAudit({ actor: user.appUser.id, action: AUDIT_ACTIONS.aiExecution, entity: 'agent_run', entity_id: run.id, metadata: { failed: true, agent: agent?.name ?? 'manager' } });
    throw error;
  }
}

/** Schema for optional AI structured outputs (kept for provider parity). */
export const leadPrioritizationSchema = z.object({
  order: z.array(z.string().uuid()),
  rationale: z.string().max(2000),
});
