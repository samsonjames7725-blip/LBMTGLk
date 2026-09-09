import type { NextRequest } from 'next/server';
import { safeText } from '@/validators/common';
import { z } from 'zod';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { companyRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

const companyCreateSchema = z.object({
  name: safeText(200).pipe(z.string().min(1, 'Company name is required')),
  website: z.string().max(2048).nullish(),
  industry: safeText(120).nullish(),
  location: safeText(200).nullish(),
  description: safeText(2000).nullish(),
});

/** GET /api/companies — search + list. */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const search = request.nextUrl.searchParams.get('search') ?? undefined;
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 100), 200);
    const result = await companyRepository.list({ search, limit });
    return ok(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/companies — create a company record. */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser('crm.write');
    const body = companyCreateSchema.parse(await request.json());
    const company = await companyRepository.create({ ...body, status: 'prospect' });
    return ok(company, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
