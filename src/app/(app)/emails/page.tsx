import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { emailRepository } from '@/repositories/supabase';
import { ConfigurationError, isEmailConfigured } from '@/supabase/server';
import { Badge, Card, EmptyState, NotConfiguredState, PageHeader, formatDate } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Email Center' };
export const dynamic = 'force-dynamic';

const STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'received', 'failed'] as const;

export default async function EmailsPage() {
  let emails;
  try {
    await getSessionUser();
    emails = await emailRepository.list({ limit: 300 });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Email Center" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Email Center"
        subtitle="AI drafts and message records — outbound delivery is not enabled"
        actions={
          <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            External sending: DISABLED / DRAFT ONLY
          </span>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card title="Sending mode">
          <p className="text-sm text-slate-600">
            The email agent creates drafts only. Sending external sales/customer emails requires the SMTP delivery
            layer, which is <strong>not implemented</strong> in this phase. Approved drafts must be delivered manually
            and their outcome recorded.
          </p>
          <p className="mt-2 text-xs text-slate-400">SMTP credentials: {isEmailConfigured() ? 'Configured' : 'Not Configured'}</p>
        </Card>
        <Card title="Status flow">
          <p className="text-sm text-slate-600">draft → pending_approval → approved → sent (manual) / failed · received (inbound)</p>
        </Card>
      </div>

      {emails.length === 0 ? (
        <EmptyState title="No email records" hint="Ask the AI: “Draft an email to <company>” to create a draft + approval request." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {STATUSES.map((status) => {
            const rows = emails.filter((e) => e.status === status);
            if (rows.length === 0) return null;
            return (
              <Card key={status} title={`${status.replaceAll('_', ' ')} (${rows.length})`}>
                <ul className="space-y-3">
                  {rows.slice(0, 6).map((email) => (
                    <li key={email.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-700">{email.subject ?? '(no subject)'}</p>
                        <Badge label={email.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        to {email.to_address ?? '—'} · {formatDate(email.created_at)}
                      </p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">{email.body}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
