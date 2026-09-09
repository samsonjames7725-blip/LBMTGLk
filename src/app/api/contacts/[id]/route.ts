import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import { contactRepository, companyRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/contacts/:id — contact with company context. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const contact = await contactRepository.getById(id);
    if (!contact) throw new NotFoundError('Contact not found');
    const company = contact.company_id ? await companyRepository.getById(contact.company_id) : null;
    return ok({ contact, company });
  } catch (error) {
    return toErrorResponse(error);
  }
}
