import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { getAnalytics } from '@/services/analytics-service';
import { ConfigurationError } from '@/supabase/server';
import { Card, NotConfiguredState, PageHeader, SimpleBarChart, formatMoney } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  let data;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    data = await getAnalytics();
  } catch (error) {
    if (error instanceof ConfigurationError || (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED')) {
      return (
        <>
          <PageHeader title="Analytics" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader title="Analytics" subtitle="All metrics computed live from database records" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Lead conversion funnel">
          <SimpleBarChart data={data.leadConversion.map((s) => ({ label: s.status, value: s.count }))} />
        </Card>
        <Card title="Lead source performance">
          <SimpleBarChart data={data.leadSourcePerformance.map((s) => ({ label: s.source, value: s.count }))} />
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {data.leadSourcePerformance.slice(0, 5).map((s) => (
              <li key={s.source}>
                {s.source}: avg score {s.avgScore}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Lead temperature">
          <SimpleBarChart data={data.leadTemperature.map((s) => ({ label: s.temperature, value: s.count }))} />
        </Card>
        <Card title="Opportunity pipeline value by stage">
          <SimpleBarChart
            data={data.pipelineByStage.map((s) => ({ label: s.stage, value: s.value }))}
            valueFormat={(v) => formatMoney(v)}
          />
        </Card>
        <Card title="Follow-up performance">
          <SimpleBarChart data={data.followupPerformance.map((s) => ({ label: s.status, value: s.count }))} />
        </Card>
        <Card title="Task performance">
          <SimpleBarChart data={data.taskPerformance.map((s) => ({ label: s.status, value: s.count }))} />
        </Card>
        <Card title="Proposal performance">
          <SimpleBarChart data={data.proposalPerformance.map((s) => ({ label: s.status, value: s.count }))} />
        </Card>
        <Card title="AI activity by agent">
          {data.aiActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No agent runs recorded.</p>
          ) : (
            <SimpleBarChart data={data.aiActivity.map((s) => ({ label: s.agent, value: s.count }))} />
          )}
        </Card>
        <Card title="Sales performance" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Win rate</p>
              <p className="text-2xl font-semibold text-slate-900">{data.salesPerformance.winRate}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Won value</p>
              <p className="text-2xl font-semibold text-emerald-600">{formatMoney(data.salesPerformance.wonValue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Lost value</p>
              <p className="text-2xl font-semibold text-rose-600">{formatMoney(data.salesPerformance.lostValue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Won / Lost</p>
              <p className="text-2xl font-semibold text-slate-900">
                {data.salesPerformance.won} / {data.salesPerformance.lost}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
