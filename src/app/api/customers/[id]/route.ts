import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import { customerRepository, companyRepository, opportunityRepository, taskRepository, followupRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/customers/:id — customer profile with related records. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const customer = await customerRepository.getById(id);
    if (!customer) throw new NotFoundError('Customer not found');
    const [company, opportunities, tasks, followups] = await Promise.all([
      companyRepository.getById(customer.company_id),
      opportunityRepository.list({ limit: 500 }),
      taskRepository.list({ limit: 200 }),
      followupRepository.list({ limit: 200 }),
    ]);
    return ok({
      customer,
      company,
      opportunities: opportunities.filter((o) => o.company_id === customer.company_id),
      tasks: tasks.filter((t) => t.customer_id === id),
      followups: followups.filter((f) => f.customer_id === id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
