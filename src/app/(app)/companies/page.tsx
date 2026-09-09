import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/auth/session';
import { companyRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Companies' };
export const dynamic = 'force-dynamic';

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  let result;
  try {
    await getSessionUser();
    result = await companyRepository.list({ search, limit: 200 });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Companies" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader title="Companies" subtitle={`${result.total} company record(s)`} />
      <form className="mb-4 flex gap-2" action="/companies">
        <input
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search companies…"
          aria-label="Search companies"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Search
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No companies found" hint="Companies are created when leads are converted or via the API." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{company.name}</h2>
                <Badge label={company.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{company.industry ?? '—'}</p>
              <p className="text-xs text-slate-400">{company.location ?? ''}</p>
              {company.website ? <p className="mt-2 truncate text-xs text-brand-600">{company.website}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
