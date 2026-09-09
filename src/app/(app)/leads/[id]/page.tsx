import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/auth/session';
import {
  followupRepository,
  interactionRepository,
  leadRepository,
  opportunityRepository,
  taskRepository,
} from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, Card, NotConfiguredState, PageHeader, formatDate, formatMoney } from '@/components/ui/primitives';
import { LeadActions } from '@/components/crm/lead-forms';
import type { Followup, Interaction, Opportunity, Task } from '@/types/database';

export const metadata: Metadata = { title: 'Lead detail' };
export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user;
  try {
    user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
  } catch {
    return <NotConfiguredState />;
  }

  const lead = await leadRepository.getById(id).catch(() => null);
  if (!lead) notFound();

  const [interactions, tasks, followups, opportunities] = await Promise.all([
    interactionRepository.listByLead(id).catch((): Interaction[] => []),
    taskRepository.list({ leadId: id }).catch((): Task[] => []),
    followupRepository.list({ leadId: id }).catch((): Followup[] => []),
    opportunityRepository.list({ limit: 500 }).catch((): Opportunity[] => []),
  ]);
  const opportunity = opportunities.find((o) => o.lead_id === id) ?? null;

  return (
    <>
      <PageHeader
        title={lead.company}
        subtitle={`${lead.contact_name ?? 'No contact'} · ${lead.email ?? 'no email'} · source: ${lead.source}`}
        actions={
          <LeadActions
            leadId={lead.id}
            status={lead.status}
            canWrite={user.permissions.includes('crm.write')}
            canDelete={user.permissions.includes('leads.delete')}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="AI score">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold tabular-nums text-brand-700">{lead.lead_score}</span>
            <Badge label={lead.lead_temperature} />
          </div>
          <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Status</dt>
              <dd>
                <Badge label={lead.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Next follow-up</dt>
              <dd>{formatDate(lead.next_followup_at)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last contact</dt>
              <dd>{formatDate(lead.last_contact_at)}</dd>
            </div>
          </dl>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Scores are deterministic and explainable (requirement completeness, company and contact details,
            decision-maker signal, urgency, budget, industry relevance, source quality).
          </p>
        </Card>

        <Card title="Requirement" className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{lead.requirement ?? 'No requirement captured yet.'}</p>
          {lead.notes ? (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{lead.notes}</p>
            </>
          ) : null}
        </Card>

        <Card title="Linked opportunity">
          {opportunity ? (
            <Link href="/opportunities" className="text-sm font-medium text-brand-700 hover:underline">
              {opportunity.name} · {opportunity.stage} · {formatMoney(opportunity.estimated_value)}
            </Link>
          ) : (
            <p className="text-sm text-slate-500">No opportunity yet. Convert the lead to create one.</p>
          )}
        </Card>

        <Card title="Interactions">
          {interactions.length === 0 ? (
            <p className="text-sm text-slate-500">No interactions recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {interactions.slice(0, 8).map((interaction) => (
                <li key={interaction.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">{interaction.subject ?? interaction.type}</span>
                    <span className="text-xs text-slate-400">{formatDate(interaction.occurred_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{interaction.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Tasks">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">{task.title}</span>
                  <Badge label={task.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Follow-ups">
          {followups.length === 0 ? (
            <p className="text-sm text-slate-500">No follow-ups scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {followups.map((followup) => (
                <li key={followup.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{followup.followup_type}</span>
                  <span className="flex items-center gap-2">
                    <Badge label={followup.status} />
                    <span className="text-xs text-slate-400">{formatDate(followup.scheduled_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
