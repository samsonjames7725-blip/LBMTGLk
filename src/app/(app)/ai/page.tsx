import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { agentRunRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, Card, NotConfiguredState, PageHeader, formatDate } from '@/components/ui/primitives';
import { CommandCenter } from '@/components/ai/command-center';

export const metadata: Metadata = { title: 'AI Command Center' };
export const dynamic = 'force-dynamic';

export default async function AIPage() {
  let runs;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    if (!user.permissions.includes('ai.run')) {
      return (
        <>
          <PageHeader title="AI Command Center" />
          <Card>
            <p className="text-sm text-slate-600">Your role does not include the ai.run permission.</p>
          </Card>
        </>
      );
    }
    runs = await agentRunRepository.listRecent(15);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="AI Command Center" />
          <NotConfiguredState feature="AI layer" />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader title="AI Command Center" subtitle="Natural-language commands routed to specialized agents" />
      <CommandCenter />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent AI activity</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-slate-500">No agent runs yet.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">
                  {run.agent_name} · {run.task_type}
                </p>
                <p className="truncate text-xs text-slate-400">{JSON.stringify(run.input)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={run.status} />
                {run.approval_required ? <Badge label="pending_approval" /> : null}
                <span className="text-xs text-slate-400">{formatDate(run.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
