import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/auth/session';
import {
  companyRepository,
  contactRepository,
  customerRepository,
  interactionRepository,
  leadRepository,
  opportunityRepository,
} from '@/repositories/supabase';
import { Badge, Card, PageHeader, Table, formatDate, formatMoney } from '@/components/ui/primitives';
import { ContactCreateForm } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Company profile' };
export const dynamic = 'force-dynamic';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUser();
  const company = await companyRepository.getById(id).catch(() => null);
  if (!company) notFound();

  const [contacts, leads, customers, opportunities, interactions] = await Promise.all([
    contactRepository.list({ companyId: id }),
    leadRepository.list({ limit: 200 }),
    customerRepository.list({ limit: 500 }),
    opportunityRepository.list({ limit: 500 }),
    interactionRepository.listByCompany(id, 10),
  ]);

  return (
    <>
      <PageHeader title={company.name} subtitle={`${company.industry ?? '—'} · ${company.location ?? '—'}`} />
      {company.description ? <p className="mb-5 max-w-3xl text-sm text-slate-600">{company.description}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Contacts (${contacts.length})`} className="lg:col-span-2">
          <div className="mb-3">
            <ContactCreateForm companyId={id} />
          </div>
          {contacts.length > 0 ? (
            <Table head={['Name', 'Designation', 'Email', 'Phone']}>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="px-4 py-2 font-medium text-slate-700">{contact.name}</td>
                  <td className="px-4 py-2 text-slate-500">{contact.designation ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{contact.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{contact.phone ?? '—'}</td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>

        <Card title="Leads">
          {leads.items.filter((l) => l.company_id === id).length === 0 ? (
            <p className="text-sm text-slate-500">No linked leads.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {leads.items
                .filter((l) => l.company_id === id)
                .map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/leads/${lead.id}`} className="text-brand-700 hover:underline">
                      {lead.company}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">
                      {lead.status} · score {lead.lead_score}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Customers">
          {customers.filter((c) => c.company_id === id).length === 0 ? (
            <p className="text-sm text-slate-500">Not a customer yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customers
                .filter((c) => c.company_id === id)
                .map((customer) => (
                  <li key={customer.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">Customer since {formatDate(customer.customer_since)}</span>
                    <Badge label={customer.customer_status} />
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Opportunities" className="lg:col-span-2">
          {opportunities.filter((o) => o.company_id === id).length === 0 ? (
            <p className="text-sm text-slate-500">No opportunities.</p>
          ) : (
            <Table head={['Name', 'Stage', 'Value', 'Close date']}>
              {opportunities
                .filter((o) => o.company_id === id)
                .map((opportunity) => (
                  <tr key={opportunity.id}>
                    <td className="px-4 py-2 font-medium text-slate-700">{opportunity.name}</td>
                    <td className="px-4 py-2">
                      <Badge label={opportunity.stage} />
                    </td>
                    <td className="px-4 py-2">{formatMoney(opportunity.estimated_value)}</td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(opportunity.expected_close_date)}</td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>

        <Card title="Recent interactions" className="lg:col-span-2">
          {interactions.length === 0 ? (
            <p className="text-sm text-slate-500">No interactions recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {interactions.map((interaction) => (
                <li key={interaction.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">{interaction.subject ?? interaction.type}</span>
                    <span className="text-xs text-slate-400">{formatDate(interaction.occurred_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
