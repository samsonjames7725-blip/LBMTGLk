import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { followupRepository, leadRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader, formatDate } from '@/components/ui/primitives';
import { FollowupActions } from '@/components/crm/forms';
import type { Followup, Lead } from '@/types/database';

export const metadata: Metadata = { title: 'Follow-up Center' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

export default async function FollowupsPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket = 'today' } = await searchParams;
  let items: Followup[] = [];
  let leads: Lead[] = [];
  try {
    await getSessionUser();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    if (bucket === 'completed') items = await followupRepository.list({ status: 'completed', limit: 100 });
    else if (bucket === 'overdue') items = await followupRepository.list({ scheduledTo: dayStart, limit: 100 }).then((rows) => rows.filter((r) => r.status !== 'completed' && r.status !== 'cancelled'));
    else if (bucket === 'upcoming') items = await followupRepository.list({ status: 'pending', scheduledFrom: dayEnd, limit: 100 });
    else items = await followupRepository.list({ status: 'pending', scheduledFrom: dayStart, scheduledTo: dayEnd, limit: 100 });
    leads = (await leadRepository.list({ limit: 500 })).items;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Follow-up Center" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const leadById = new Map(leads.map((l) => [l.id, l]));

  return (
    <>
      <PageHeader title="Follow-up Center" subtitle="Internal follow-up work — AI drafts always require review before external use" />

      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/followups?bucket=${tab.key}`}
            role="tab"
            aria-selected={bucket === tab.key}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${bucket === tab.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={`No ${bucket} follow-ups`} hint="Schedule follow-ups from a lead or via POST /api/followups." />
      ) : (
        <ul className="space-y-2">
          {items.map((followup) => {
            const lead = followup.lead_id ? leadById.get(followup.lead_id) : null;
            return (
              <li key={followup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {lead ? (
                      <Link href={`/leads/${lead.id}`} className="text-brand-700 hover:underline">
                        {lead.company}
                      </Link>
                    ) : (
                      'General follow-up'
                    )}
                    <span className="ml-2 text-xs font-normal text-slate-400">{followup.followup_type}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(followup.scheduled_at)} · priority {followup.priority}
                  </p>
                  {followup.draft_content ? (
                    <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-800" data-ai-draft>
                      AI Draft — {followup.draft_content.slice(0, 180)}
                      {followup.draft_content.length > 180 ? '…' : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={followup.status} />
                  {['pending', 'overdue'].includes(followup.status) ? <FollowupActions followupId={followup.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
