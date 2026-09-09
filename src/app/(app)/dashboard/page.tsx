import type { Metadata } from 'next';
import { getDashboardData } from '@/services/dashboard-service';
import { ConfigurationError } from '@/supabase/server';
import {
  Card,
  ErrorState,
  KpiCard,
  PageHeader,
  SimpleBarChart,
  Badge,
  Table,
  formatDate,
  formatMoney,
  NotConfiguredState,
} from '@/components/ui/primitives';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch (error) {
    if (error instanceof ConfigurationError || (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED')) {
      return (
        <>
          <PageHeader title="Executive Dashboard" subtitle="Real-time business overview" />
          <NotConfiguredState />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Executive Dashboard" subtitle="Real-time business overview" />
        <ErrorState title="Dashboard failed to load" hint={error instanceof Error ? error.message : undefined} />
      </>
    );
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Live data from Supabase — no placeholder metrics"
        actions={
          <Link href="/ai" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Ask LifeBridge AI
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="New Leads" value={kpis.newLeads} />
        <KpiCard label="Qualified Leads" value={kpis.qualifiedLeads} tone="good" />
        <KpiCard label="Hot Leads" value={kpis.hotLeads} tone={kpis.hotLeads > 0 ? 'alert' : 'default'} />
        <KpiCard label="Open Opportunities" value={kpis.openOpportunities} />
        <KpiCard label="Pipeline Value" value={formatMoney(kpis.pipelineValue)} />
        <KpiCard label="Overdue Follow-ups" value={kpis.overdueFollowups} tone={kpis.overdueFollowups > 0 ? 'alert' : 'default'} />
        <KpiCard label="Open Proposals" value={kpis.openProposals} />
        <KpiCard label="Won" value={kpis.wonOpportunities} tone="good" />
        <KpiCard label="Lost" value={kpis.lostOpportunities} />
        <KpiCard label="AI Activity (30d)" value={kpis.aiRuns30d} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="AI recommendations">
          <ul className="space-y-2 text-sm text-slate-600">
            {data.recommendedActions.map((action) => (
              <li key={action} className="flex gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {action}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pipeline by stage (open)">
          <SimpleBarChart data={data.pipelineByStage.map((s) => ({ label: s.stage, value: s.count }))} />
        </Card>

        <Card title="New leads — last 14 days">
          <SimpleBarChart data={data.leadsLast14Days.map((d) => ({ label: d.date, value: d.count }))} />
        </Card>

        <Card title="Follow-up alerts">
          {data.overdueFollowupLeads.length === 0 ? (
            <p className="text-sm text-slate-500">No overdue follow-ups. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueFollowupLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm">
                  <Link href={`/leads/${l.id}`} className="font-medium text-rose-700 hover:underline">
                    {l.company}
                  </Link>
                  <span className="text-xs text-rose-500">score {l.score}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming tasks">
          {data.upcomingTasks.length === 0 ? (
            <p className="text-sm text-slate-500">No open tasks.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.upcomingTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-slate-700">{task.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge label={task.priority} />
                    <span className="text-xs text-slate-400">{formatDate(task.due_date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No recorded activity yet.</p>
          ) : (
            <Table head={['Action', 'Entity', 'When']}>
              {data.recentActivity.slice(0, 8).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 font-medium text-slate-700">{entry.action}</td>
                  <td className="px-4 py-2 text-slate-500">{entry.entity ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-400">{formatDate(entry.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
