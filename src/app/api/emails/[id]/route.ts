import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import { emailRepository, leadRepository, customerRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/emails/:id — email with lead/customer context. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const email = await emailRepository.getById(id);
    if (!email) throw new NotFoundError('Email not found');
    const lead = email.lead_id ? await leadRepository.getById(email.lead_id) : null;
    const customer = email.customer_id ? await customerRepository.getById(email.customer_id) : null;
    return ok({ email, lead, customer });
  } catch (error) {
    return toErrorResponse(error);
  }
}
