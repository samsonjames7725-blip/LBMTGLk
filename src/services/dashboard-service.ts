import { tryGetAdminClient } from '@/supabase/server';
import type { AgentRun, AutomationRun, AuditLog, Lead, Opportunity, Task } from '@/types/database';
import { OPPORTUNITY_STAGES } from '@/ai/agents/stage-constants';

export interface DashboardData {
  kpis: {
    newLeads: number;
    qualifiedLeads: number;
    hotLeads: number;
    openOpportunities: number;
    pipelineValue: number;
    overdueFollowups: number;
    openProposals: number;
    wonOpportunities: number;
    lostOpportunities: number;
    aiRuns30d: number;
  };
  pipelineByStage: { stage: string; count: number; value: number }[];
  leadsLast14Days: { date: string; count: number }[];
  upcomingTasks: Task[];
  overdueFollowupLeads: { id: string; company: string; score: number }[];
  recentActivity: AuditLog[];
  recentAgentRuns: AgentRun[];
  recentAutomations: AutomationRun[];
  recommendedActions: string[];
}

const OPEN_PROPOSAL_STATUSES = ['draft', 'pending_approval', 'approved'];
const days = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

export async function getDashboardData(): Promise<DashboardData> {
  const admin = tryGetAdminClient();
  if (!admin) throw new Error('DATABASE_NOT_CONFIGURED');

  const since30d = days(30);

  const [leadsAll, opportunities, proposals, recentTasks, auditRecent, agentRuns, automations] = await Promise.all([
    admin.from('leads').select('id,company,status,lead_score,lead_temperature,next_followup_at,created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('opportunities').select('id,name,stage,estimated_value,expected_close_date,next_action').limit(1000),
    admin.from('proposals').select('id,status').limit(1000),
    admin.from('tasks').select('*').in('status', ['todo', 'in_progress']).order('due_date', { ascending: true, nullsFirst: false }).limit(8),
    admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(12),
    admin.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(8),
    admin.from('automation_runs').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const leads = (leadsAll.data ?? []) as Lead[];

  const countBy = <T, K extends keyof T>(rows: T[], key: K, value: T[K]) => rows.filter((r) => r[key] === value).length;

  const kpis = {
    newLeads: countBy(leads, 'status', 'new' as const),
    qualifiedLeads: countBy(leads, 'status', 'qualified' as const),
    hotLeads: countBy(leads, 'lead_temperature', 'hot' as const),
    openOpportunities: (opportunities.data ?? []).filter((o) => !['won', 'lost'].includes(o.stage)).length,
    pipelineValue: (opportunities.data ?? [])
      .filter((o) => !['won', 'lost'].includes(o.stage))
      .reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
    overdueFollowups: 0, // filled below via followups query
    openProposals: (proposals.data ?? []).filter((p) => OPEN_PROPOSAL_STATUSES.includes(p.status)).length,
    wonOpportunities: (opportunities.data ?? []).filter((o) => o.stage === 'won').length,
    lostOpportunities: (opportunities.data ?? []).filter((o) => o.stage === 'lost').length,
    aiRuns30d: (agentRuns.data ?? []).filter((r) => new Date(r.created_at) >= new Date(since30d)).length,
  };

  const { count: overdueFollowups } = await admin
    .from('followups')
    .select('id', { count: 'exact', head: true })
    .in('status', ['overdue', 'pending'])
    .lt('scheduled_at', new Date().toISOString());
  kpis.overdueFollowups = overdueFollowups ?? 0;

  const pipelineByStage = OPPORTUNITY_STAGES.map((stage) => {
    const rows = (opportunities.data ?? []).filter((o) => o.stage === stage && !['won', 'lost'].includes(stage));
    return {
      stage,
      count: rows.length,
      value: rows.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
    };
  });

  const leadsLast14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    const next = new Date(d.getTime() + 24 * 3600 * 1000);
    return {
      date: d.toISOString().slice(0, 10),
      count: leads.filter((l) => {
        const created = new Date(l.created_at);
        return created >= d && created < next;
      }).length,
    };
  });

  const { data: overdueRows } = await admin
    .from('followups')
    .select('lead_id')
    .in('status', ['overdue', 'pending'])
    .lt('scheduled_at', new Date().toISOString())
    .limit(10);
  const overdueLeadIds = [...new Set((overdueRows ?? []).map((r) => r.lead_id).filter((id): id is string => Boolean(id)))];
  const overdueFollowupLeads = overdueLeadIds
    .map((id) => leads.find((l) => l.id === id))
    .filter((l): l is Lead => Boolean(l))
    .map((l) => ({ id: l.id, company: l.company, score: l.lead_score }));

  const recommendedActions = buildRecommendations(leads, (opportunities.data ?? []) as Opportunity[], kpis.overdueFollowups);

  return {
    kpis,
    pipelineByStage,
    leadsLast14Days,
    upcomingTasks: (recentTasks.data ?? []) as Task[],
    overdueFollowupLeads,
    recentActivity: (auditRecent.data ?? []) as AuditLog[],
    recentAgentRuns: (agentRuns.data ?? []) as AgentRun[],
    recentAutomations: (automations.data ?? []) as AutomationRun[],
    recommendedActions,
  };
}

function buildRecommendations(leads: Lead[], opportunities: Opportunity[], overdueFollowups: number): string[] {
  const actions: string[] = [];
  if (overdueFollowups > 0) actions.push(`${overdueFollowups} follow-up(s) are overdue — clear them before new outreach.`);
  const hot = leads.filter((l) => l.lead_temperature === 'hot' && !['converted', 'lost'].includes(l.status));
  if (hot.length > 0) actions.push(`${hot.length} hot lead(s) waiting — contact the highest scorer within 24 hours.`);
  const staleOpps = opportunities.filter(
    (o) => !['won', 'lost'].includes(o.stage) && (!o.next_action || (o.expected_close_date && new Date(o.expected_close_date) < new Date())),
  );
  if (staleOpps.length > 0) actions.push(`${staleOpps.length} opportunity/opportunities need a next action or a revised close date.`);
  if (actions.length === 0) actions.push('Pipeline is in good shape — no urgent actions detected.');
  return actions.slice(0, 4);
}
