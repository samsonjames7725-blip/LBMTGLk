import type { AIProvider } from '@/ai/provider';
import { leadRepository } from '@/repositories/supabase';
import type { Lead } from '@/types/database';
import type { Agent, AgentResult } from './types';

/** Lead Agent (spec §35, ACTIVE): qualification, scoring, prioritization. */
export const leadAgent: Agent = {
  name: 'lead',
  taskType: 'lead',
  description: 'Lead qualification, scoring, prioritization and recommended next actions.',

  async handle(command: string, _user, _provider: AIProvider): Promise<AgentResult> {
    const lower = command.toLowerCase();
    const wantsHot = lower.includes('hot');
    const wantsWebsite = lower.includes('website');
    const wantsToday = lower.includes('today');

    const { items: leads, total } = await leadRepository.list({
      status: wantsHot ? undefined : undefined,
      temperature: wantsHot ? 'hot' : undefined,
      source: wantsWebsite ? 'website' : undefined,
      sort: 'lead_score',
      order: 'desc',
      limit: 10,
    });

    const candidates = leads.filter((l) => ['new', 'contacted', 'qualified'].includes(l.status));
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const todaysNew = wantsToday ? candidates.filter((l) => new Date(l.created_at).getTime() >= dayAgo) : candidates;

    return {
      summary:
        candidates.length === 0
          ? 'No open leads matched this request.'
          : `Top ${candidates.length} of ${total} open leads ranked by AI score.`,
      data: {
        leads: candidates.map((lead: Lead) => ({
          id: lead.id,
          company: lead.company,
          contact: lead.contact_name,
          email: lead.email,
          score: lead.lead_score,
          temperature: lead.lead_temperature,
          status: lead.status,
          requirement: lead.requirement?.slice(0, 200) ?? null,
          next_followup_at: lead.next_followup_at,
        })),
        todays_new_count: wantsToday ? todaysNew.length : undefined,
      },
      recommended_actions: buildRecommendations(candidates),
      approval_required: false,
    };
  },
};

function buildRecommendations(leads: Lead[]): string[] {
  if (leads.length === 0) return ['No action needed — no open leads.'];
  const hottest = leads[0];
  const actions = [
    `Contact ${hottest.company} first (score ${hottest.lead_score}, ${hottest.lead_temperature}).`,
  ];
  const unscored = leads.filter((l) => l.lead_score === 0).length;
  if (unscored > 0) actions.push(`Run lead qualification for ${unscored} unscored lead(s).`);
  const stale = leads.filter((l) => !l.next_followup_at).length;
  if (stale > 0) actions.push(`Schedule follow-ups for ${stale} lead(s) without a next step.`);
  return actions;
}
