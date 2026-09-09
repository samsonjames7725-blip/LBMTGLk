import { automationRunRepository, followupRepository, leadRepository, taskRepository } from '@/repositories/supabase';
import { recordAudit } from '../audit-service';

export const AUTOMATION_JOBS = [
  'lead-qualification',
  'overdue-followups',
  'daily-report',
  'pipeline-monitoring',
  'customer-reactivation',
] as const;

export type AutomationJob = (typeof AUTOMATION_JOBS)[number];

/**
 * Automation runner (spec §60/§61). Every job may perform INTERNAL actions
 * only: create tasks, create drafts, create alerts, update internal records.
 * No external communication ever happens here (spec §101).
 */
export async function runAutomation(job: AutomationJob): Promise<Record<string, unknown>> {
  switch (job) {
    case 'lead-qualification':
      return runLeadQualification();
    case 'overdue-followups':
      return runOverdueFollowups();
    case 'daily-report':
      return runDailyReport();
    case 'pipeline-monitoring':
      return runPipelineMonitoring();
    case 'customer-reactivation':
      return runCustomerReactivation();
  }
}

/** Executes a job and records the automation run (success or failure). */
export async function runAutomationWithLogging(job: AutomationJob): Promise<{ runId: string; result: Record<string, unknown> }> {
  const run = await automationRunRepository.start(job);
  try {
    const result = await runAutomation(job);
    await automationRunRepository.complete(run.id, result);
    await recordAudit({ actor: null, action: `automation_${job}`, entity: 'automation_run', entity_id: run.id, metadata: { status: 'success' } });
    return { runId: run.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    await automationRunRepository.fail(run.id, message);
    await recordAudit({ actor: null, action: `automation_${job}`, entity: 'automation_run', entity_id: run.id, metadata: { status: 'failed' } });
    throw error;
  }
}

async function runLeadQualification(): Promise<Record<string, unknown>> {
  const { items } = await leadRepository.list({ status: 'new', sort: 'created_at', order: 'asc', limit: 100 });
  const { scoreLead } = await import('../lead-scoring');
  let scored = 0;
  let tasksCreated = 0;
  for (const lead of items) {
    const scoring = scoreLead({
      company: lead.company,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
      location: lead.location,
      industry: lead.industry,
      requirement: lead.requirement,
      source: lead.source,
    });
    await leadRepository.update(lead.id, {
      lead_score: scoring.score,
      lead_temperature: scoring.temperature,
      assigned_agent: 'lead',
    });
    scored += 1;
    if (scoring.temperature === 'hot') {
      const existing = await taskRepository.list({ leadId: lead.id, status: 'todo', limit: 1 });
      if (existing.length === 0) {
        await taskRepository.create({
          title: `Contact hot lead: ${lead.company}`,
          description: `Automation: lead scored ${scoring.score} (hot). ${scoring.recommended_action}`,
          priority: 'high',
          status: 'todo',
          lead_id: lead.id,
          due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        });
        tasksCreated += 1;
      }
    }
  }
  return { scored, hotTasksCreated: tasksCreated };
}

async function runOverdueFollowups(): Promise<Record<string, unknown>> {
  const flagged = await followupRepository.markOverdue();
  return { flaggedOverdue: flagged };
}

async function runDailyReport(): Promise<Record<string, unknown>> {
  const { getDashboardData } = await import('../dashboard-service');
  const data = await getDashboardData();
  // Internal report only — never sent externally (spec §59).
  return {
    report: {
      newLeads: data.kpis.newLeads,
      qualifiedLeads: data.kpis.qualifiedLeads,
      hotLeads: data.kpis.hotLeads,
      pipelineValue: data.kpis.pipelineValue,
      overdueFollowups: data.kpis.overdueFollowups,
      openProposals: data.kpis.openProposals,
      won: data.kpis.wonOpportunities,
      lost: data.kpis.lostOpportunities,
      aiRuns30d: data.kpis.aiRuns30d,
      recommendedActions: data.recommendedActions,
    },
  };
}

async function runPipelineMonitoring(): Promise<Record<string, unknown>> {
  const { opportunityRepository } = await import('@/repositories/supabase');
  const opportunities = await opportunityRepository.list({ limit: 500 });
  const open = opportunities.filter((o) => !['won', 'lost'].includes(o.stage));
  const stale = open.filter((o) => !o.next_action);
  const pastDue = open.filter((o) => o.expected_close_date && new Date(o.expected_close_date) < new Date());
  for (const opp of pastDue.slice(0, 10)) {
    await taskRepository.create({
      title: `Review past-due opportunity: ${opp.name}`,
      description: 'Automation: expected close date has passed. Update the stage or revise the date.',
      priority: 'high',
      status: 'todo',
      opportunity_id: opp.id,
      assigned_to: opp.owner_id,
      due_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    });
  }
  return { openCount: open.length, staleCount: stale.length, pastDueCount: pastDue.length, reviewTasksCreated: Math.min(pastDue.length, 10) };
}

async function runCustomerReactivation(): Promise<Record<string, unknown>> {
  const admin = (await import('@/supabase/server')).tryGetAdminClient();
  if (!admin) throw new Error('DATABASE_NOT_CONFIGURED');
  const sixMonthsAgo = new Date(Date.now() - 182 * 24 * 3600 * 1000).toISOString();
  const { data: inactive } = await admin
    .from('customers')
    .select('id,company_id,notes,created_at')
    .eq('customer_status', 'active')
    .lt('updated_at', sixMonthsAgo)
    .limit(25);
  let tasksCreated = 0;
  for (const customer of (inactive ?? []) as { id: string; company_id: string }[]) {
    await taskRepository.create({
      title: 'Customer reactivation check-in',
      description: 'Automation: this active customer has had no updates in over 6 months. Schedule a check-in.',
      priority: 'medium',
      status: 'todo',
      customer_id: customer.id,
    });
    tasksCreated += 1;
  }
  return { candidatesFound: (inactive ?? []).length, reactivationTasksCreated: tasksCreated };
}
