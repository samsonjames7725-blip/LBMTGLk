import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { opportunityRepository, companyRepository, userRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, Card, EmptyState, NotConfiguredState, PageHeader, formatMoney } from '@/components/ui/primitives';
import { OpportunityStageSelect } from '@/components/crm/forms';
import type { AppUser, Company, Opportunity } from '@/types/database';

export const metadata: Metadata = { title: 'Opportunity Pipeline' };
export const dynamic = 'force-dynamic';

const OPEN_STAGES = ['new', 'qualified', 'contacted', 'requirement_confirmed', 'proposal_required', 'proposal_sent', 'negotiation'];
const CLOSED_STAGES = ['won', 'lost'];

export default async function OpportunitiesPage() {
  let opportunities: Opportunity[] = [];
  let companies: Company[] = [];
  let users: AppUser[] = [];
  try {
    await getSessionUser();
    [opportunities, companies, users] = await Promise.all([
      opportunityRepository.list({ limit: 500 }),
      companyRepository.list({ limit: 500 }).then((r) => r.items),
      userRepository.list(200),
    ]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Opportunity Pipeline" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? 'Unknown';
  const ownerName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? 'Unassigned' : 'Unassigned');
  const canWrite = true;

  function Column({ stage, items }: { stage: string; items: typeof opportunities }) {
    const total = items.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
    return (
      <div className="min-w-64 flex-1">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.replaceAll('_', ' ')}</h3>
          <span className="text-xs text-slate-400">{items.length}</span>
        </div>
        <div className="space-y-2 rounded-xl bg-slate-200/50 p-2">
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400">Empty</p>
          ) : (
            items.map((opportunity) => (
              <div key={opportunity.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-medium text-slate-800">{opportunity.name}</p>
                <p className="text-xs text-slate-500">{companyName(opportunity.company_id)}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-brand-700">{formatMoney(opportunity.estimated_value)}</p>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{opportunity.probability != null ? `${opportunity.probability}%` : ''}</span>
                  <span>{ownerName(opportunity.owner_id)}</span>
                </div>
                {opportunity.next_action ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{opportunity.next_action}</p> : null}
                <div className="mt-2">
                  <OpportunityStageSelect opportunityId={opportunity.id} stage={opportunity.stage} disabled={!canWrite} />
                </div>
              </div>
            ))
          )}
          {total > 0 ? <p className="px-2 pt-1 text-right text-xs font-medium tabular-nums text-slate-500">{formatMoney(total)}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Opportunity Pipeline" subtitle="Drag-free board — change the stage directly on a card" />
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {OPEN_STAGES.map((stage) => (
            <Column key={stage} stage={stage} items={opportunities.filter((o) => o.stage === stage)} />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {CLOSED_STAGES.map((stage) => {
          const closed = opportunities.filter((o) => o.stage === stage);
          return (
            <Card key={stage} title={`${stage} (${closed.length})`}>
              {closed.length === 0 ? (
                <p className="text-sm text-slate-500">None yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {closed.map((opportunity) => (
                    <li key={opportunity.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-slate-700">{opportunity.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge label={stage} />
                        <span className="tabular-nums text-slate-500">{formatMoney(opportunity.estimated_value)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {opportunities.length === 0 ? <EmptyState title="No opportunities yet" hint="Convert a lead or create one via POST /api/opportunities." /> : null}
    </>
  );
}
