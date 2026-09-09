import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { approvalRepository, userRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader, formatDate } from '@/components/ui/primitives';
import { ApprovalActions } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Approval Center' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'executed', label: 'Executed' },
];

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'pending' } = await searchParams;
  let canReview = false;
  let approvals, users;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    canReview = user.permissions.includes('approvals.review');
    [approvals, users] = await Promise.all([
      approvalRepository.list({ status: status as never, limit: 200 }),
      userRepository.list(200),
    ]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Approval Center" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? 'Unknown' : 'System');

  return (
    <>
      <PageHeader
        title="Approval Center"
        subtitle="Human-in-the-loop gate for protected actions — AI cannot bypass this workflow"
      />

      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/approvals?status=${tab.key}`}
            role="tab"
            aria-selected={status === tab.key}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${status === tab.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {approvals.length === 0 ? (
        <EmptyState title={`No ${status} approvals`} hint="AI drafts and proposals automatically create approval requests here." />
      ) : (
        <ul className="space-y-3">
          {approvals.map((approval) => (
            <li key={approval.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{approval.action_type.replaceAll('_', ' ')}</span>
                    <Badge label={approval.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    requested by {userName(approval.requested_by)} · {formatDate(approval.created_at)}
                    {approval.reviewed_by ? ` · reviewed by ${userName(approval.reviewed_by)}` : ''}
                  </p>
                  {approval.payload && Object.keys(approval.payload).length > 0 ? (
                    <pre className="mt-2 max-w-2xl overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      {JSON.stringify(approval.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
                {approval.status === 'pending' ? (
                  <ApprovalActions approvalId={approval.id} canReview={canReview} />
                ) : approval.status === 'approved' && canReview ? (
                  <Link
                    href="/approvals?status=approved"
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-500"
                    title="Execute via POST /api/approvals/:id/execute"
                  >
                    Awaiting execution
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
