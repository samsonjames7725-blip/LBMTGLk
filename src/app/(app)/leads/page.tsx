import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { leadRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { leadListQuerySchema } from '@/validators/lead';
import { Badge, EmptyState, NotConfiguredState, PageHeader, Table, formatDate } from '@/components/ui/primitives';
import { LeadFilters, NewLeadForm } from '@/components/crm/lead-forms';

export const metadata: Metadata = { title: 'Leads' };
export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const query = leadListQuerySchema.safeParse(flat);
  const filters = query.success ? query.data : leadListQuerySchema.parse({});

  let user = null;
  let result;
  try {
    user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    result = await leadRepository.list(filters);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Leads" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${result.total} lead(s) — scored by the deterministic AI scoring engine`}
        actions={<NewLeadForm canWrite={user!.permissions.includes('crm.write')} />}
      />
      <div className="mb-4">
        <LeadFilters
          initial={{ search: filters.search, status: filters.status, temperature: filters.temperature, sort: filters.sort }}
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="No leads match" hint="Adjust the filters or create a new lead to get started." />
      ) : (
        <Table head={['Company', 'Contact', 'Status', 'Temperature', 'Score', 'Source', 'Next follow-up', 'Created']}>
          {result.items.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link href={`/leads/${lead.id}`} className="font-medium text-brand-700 hover:underline">
                  {lead.company}
                </Link>
                <div className="text-xs text-slate-400">{lead.location ?? lead.industry ?? ''}</div>
              </td>
              <td className="px-4 py-2.5">
                <div className="text-slate-700">{lead.contact_name ?? '—'}</div>
                <div className="text-xs text-slate-400">{lead.email ?? ''}</div>
              </td>
              <td className="px-4 py-2.5">
                <Badge label={lead.status} />
              </td>
              <td className="px-4 py-2.5">
                <Badge label={lead.lead_temperature} />
              </td>
              <td className="px-4 py-2.5 font-semibold tabular-nums text-slate-800">{lead.lead_score}</td>
              <td className="px-4 py-2.5 text-slate-500">{lead.source}</td>
              <td className="px-4 py-2.5 text-slate-500">{formatDate(lead.next_followup_at)}</td>
              <td className="px-4 py-2.5 text-slate-400">{formatDate(lead.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
