import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { customerRepository, companyRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader, Table, formatDate } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  let customers, companies;
  try {
    await getSessionUser();
    [customers, companies] = await Promise.all([customerRepository.list({ limit: 300 }), companyRepository.list({ limit: 500 })]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Customers" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const companyById = new Map(companies.items.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} customer record(s)`} />
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" hint="Convert a qualified lead to create the first customer record." />
      ) : (
        <Table head={['Company', 'Status', 'Customer since', 'Primary contact']}>
          {customers.map((customer) => {
            const company = companyById.get(customer.company_id);
            return (
              <tr key={customer.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  {company ? (
                    <Link href={`/companies/${company.id}`} className="font-medium text-brand-700 hover:underline">
                      {company.name}
                    </Link>
                  ) : (
                    customer.company_id
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Badge label={customer.customer_status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500">{formatDate(customer.customer_since)}</td>
                <td className="px-4 py-2.5 text-slate-500">{customer.primary_contact_id ? 'Linked' : '—'}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
