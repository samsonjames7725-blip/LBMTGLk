import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { proposalRepository, opportunityRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader, Table, formatDate, formatMoney } from '@/components/ui/primitives';
import { ProposalCreateForm } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Proposals' };
export const dynamic = 'force-dynamic';

export default async function ProposalsPage() {
  let proposals, opportunities;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    [proposals, opportunities] = await Promise.all([
      proposalRepository.list({ limit: 200 }),
      opportunityRepository.list({ limit: 500 }),
    ]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Proposals" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const openOpportunities = opportunities.filter((o) => !['won', 'lost'].includes(o.stage));

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Draft proposals queued through the approval workflow"
        actions={<ProposalCreateForm opportunities={openOpportunities.map((o) => ({ id: o.id, name: o.name }))} />}
      />
      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet" hint="Create a proposal for an open opportunity; it starts in pending_approval." />
      ) : (
        <Table head={['Title', 'Status', 'Value', 'Opportunity', 'Created']}>
          {proposals.map((proposal) => (
            <tr key={proposal.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-700">{proposal.title}</td>
              <td className="px-4 py-2.5">
                <Badge label={proposal.status} />
              </td>
              <td className="px-4 py-2.5 tabular-nums text-slate-600">{formatMoney(proposal.estimated_value)}</td>
              <td className="px-4 py-2.5 text-slate-500">
                {opportunities.find((o) => o.id === proposal.opportunity_id)?.name ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-slate-400">{formatDate(proposal.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
