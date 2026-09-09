import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { customerRepository, companyRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/customers — list with company summary. */
export async function GET(_request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const customers = await customerRepository.list({ limit: 200 });
    const companies = await companyRepository.list({ limit: 500 });
    const withCompany = customers.map((c) => ({
      ...c,
      company: companies.items.find((co) => co.id === c.company_id) ?? null,
    }));
    return ok({ items: withCompany, total: withCompany.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
