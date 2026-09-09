import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { contactRepository, companyRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { EmptyState, NotConfiguredState, PageHeader, Table } from '@/components/ui/primitives';
import { ContactCreateForm } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Contacts' };
export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  let contacts, companies;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    [contacts, companies] = await Promise.all([
      contactRepository.list({ limit: 300 }),
      companyRepository.list({ limit: 500 }),
    ]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Contacts" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const companyNames = new Map(companies.items.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Contacts" subtitle={`${contacts.length} contact(s)`} actions={<ContactCreateForm />} />
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" hint="Add contacts directly or convert leads to create them automatically." />
      ) : (
        <Table head={['Name', 'Company', 'Designation', 'Email', 'Phone']}>
          {contacts.map((contact) => (
            <tr key={contact.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-700">{contact.name}</td>
              <td className="px-4 py-2.5">
                {contact.company_id ? (
                  <Link href={`/companies/${contact.company_id}`} className="text-brand-700 hover:underline">
                    {companyNames.get(contact.company_id) ?? contact.company_id}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-500">{contact.designation ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-500">{contact.email ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-500">{contact.phone ?? '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
