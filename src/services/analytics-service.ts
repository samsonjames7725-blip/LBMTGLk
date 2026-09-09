import { tryGetAdminClient } from '@/supabase/server';
import type { AgentRun, Followup, Lead, Opportunity, Proposal, Task } from '@/types/database';

export interface AnalyticsData {
  leadConversion: { status: string; count: number }[];
  leadSourcePerformance: { source: string; count: number; avgScore: number }[];
  leadTemperature: { temperature: string; count: number }[];
  pipelineByStage: { stage: string; count: number; value: number }[];
  followupPerformance: { status: string; count: number }[];
  proposalPerformance: { status: string; count: number }[];
  taskPerformance: { status: string; count: number }[];
  aiActivity: { agent: string; count: number; completed: number; failed: number }[];
  salesPerformance: { won: number; lost: number; wonValue: number; lostValue: number; winRate: number };
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];
const FOLLOWUP_STATUSES = ['pending', 'completed', 'cancelled', 'overdue'];
const PROPOSAL_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected'];
const TASK_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled'];
const OPPORTUNITY_STAGES = ['new', 'qualified', 'contacted', 'requirement_confirmed', 'proposal_required', 'proposal_sent', 'negotiation', 'won', 'lost'];

/** All analytics computed from real database rows (spec §58, §100). */
export async function getAnalytics(): Promise<AnalyticsData> {
  const admin = tryGetAdminClient();
  if (!admin) throw new Error('DATABASE_NOT_CONFIGURED');

  const [leadsRes, opportunitiesRes, followupsRes, proposalsRes, tasksRes, agentRunsRes] = await Promise.all([
    admin.from('leads').select('status,lead_temperature,lead_score,source').limit(5000),
    admin.from('opportunities').select('stage,estimated_value').limit(5000),
    admin.from('followups').select('status').limit(5000),
    admin.from('proposals').select('status').limit(5000),
    admin.from('tasks').select('status').limit(5000),
    admin.from('agent_runs').select('agent_name,status').limit(5000),
  ]);

  const leads = (leadsRes.data ?? []) as Pick<Lead, 'status' | 'lead_temperature' | 'lead_score' | 'source'>[];
  const opportunities = (opportunitiesRes.data ?? []) as Pick<Opportunity, 'stage' | 'estimated_value'>[];
  const followups = (followupsRes.data ?? []) as Pick<Followup, 'status'>[];
  const proposals = (proposalsRes.data ?? []) as Pick<Proposal, 'status'>[];
  const tasks = (tasksRes.data ?? []) as Pick<Task, 'status'>[];
  const agentRuns = (agentRunsRes.data ?? []) as Pick<AgentRun, 'agent_name' | 'status'>[];

  const sourceMap = new Map<string, { count: number; scoreSum: number }>();
  for (const lead of leads) {
    const entry = sourceMap.get(lead.source) ?? { count: 0, scoreSum: 0 };
    entry.count += 1;
    entry.scoreSum += lead.lead_score;
    sourceMap.set(lead.source, entry);
  }

  const agentMap = new Map<string, { count: number; completed: number; failed: number }>();
  for (const run of agentRuns) {
    const entry = agentMap.get(run.agent_name) ?? { count: 0, completed: 0, failed: 0 };
    entry.count += 1;
    if (run.status === 'completed') entry.completed += 1;
    if (run.status === 'failed') entry.failed += 1;
    agentMap.set(run.agent_name, entry);
  }

  const won = opportunities.filter((o) => o.stage === 'won');
  const lost = opportunities.filter((o) => o.stage === 'lost');

  return {
    leadConversion: LEAD_STATUSES.map((status) => ({ status, count: leads.filter((l) => l.status === status).length })),
    leadSourcePerformance: [...sourceMap.entries()]
      .map(([source, { count, scoreSum }]) => ({ source, count, avgScore: count ? Math.round(scoreSum / count) : 0 }))
      .sort((a, b) => b.count - a.count),
    leadTemperature: ['hot', 'warm', 'cold'].map((temperature) => ({
      temperature,
      count: leads.filter((l) => l.lead_temperature === temperature).length,
    })),
    pipelineByStage: OPPORTUNITY_STAGES.map((stage) => {
      const rows = opportunities.filter((o) => o.stage === stage);
      return { stage, count: rows.length, value: rows.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0) };
    }),
    followupPerformance: FOLLOWUP_STATUSES.map((status) => ({ status, count: followups.filter((f) => f.status === status).length })),
    proposalPerformance: PROPOSAL_STATUSES.map((status) => ({ status, count: proposals.filter((p) => p.status === status).length })),
    taskPerformance: TASK_STATUSES.map((status) => ({ status, count: tasks.filter((t) => t.status === status).length })),
    aiActivity: [...agentMap.entries()].map(([agent, stats]) => ({ agent, ...stats })),
    salesPerformance: {
      won: won.length,
      lost: lost.length,
      wonValue: won.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
      lostValue: lost.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
      winRate: won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
    },
  };
}
