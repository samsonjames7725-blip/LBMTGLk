import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import {
  companyRepository,
  contactRepository,
  customerRepository,
  interactionRepository,
  leadRepository,
  opportunityRepository,
} from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/companies/:id — company profile with contacts, leads, customers, opportunities, interactions. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const company = await companyRepository.getById(id);
    if (!company) throw new NotFoundError('Company not found');
    const [contacts, allLeads, customers, opportunities, interactions] = await Promise.all([
      contactRepository.list({ companyId: id }),
      leadRepository.list({ limit: 200 }),
      customerRepository.list({ limit: 500 }),
      opportunityRepository.list({ limit: 500 }),
      interactionRepository.listByCompany(id),
    ]);
    return ok({
      company,
      contacts,
      leads: allLeads.items.filter((l) => l.company_id === id),
      customers: customers.filter((c) => c.company_id === id),
      opportunities: opportunities.filter((o) => o.company_id === id),
      interactions,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
