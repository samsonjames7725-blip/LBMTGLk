import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeText } from '@/validators/common';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { contactRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

const contactCreateSchema = z.object({
  company_id: z.string().uuid().nullish(),
  name: safeText(160).pipe(z.string().min(1, 'Name is required')),
  designation: safeText(160).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(25).nullish(),
  linkedin: z.string().max(300).nullish(),
  notes: safeText(2000).nullish(),
});

/** GET /api/contacts — list (optionally by company). */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const companyId = request.nextUrl.searchParams.get('company_id') ?? undefined;
    const contacts = await contactRepository.list({ companyId, limit: 200 });
    return ok({ items: contacts, total: contacts.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/contacts — create a contact. */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser('crm.write');
    const body = contactCreateSchema.parse(await request.json());
    const contact = await contactRepository.create(body);
    return ok(contact, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
