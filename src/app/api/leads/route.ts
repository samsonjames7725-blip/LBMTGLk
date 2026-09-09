import type { NextRequest } from 'next/server';
import { leadCreateSchema, leadListQuerySchema } from '@/validators/lead';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, fail, HttpError } from '@/security/http';
import { rateLimit, clientIp } from '@/security/rate-limit';
import { createLead } from '@/services/lead-service';
import { leadRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/leads — search/filter/sort (spec §47). */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const query = leadListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await leadRepository.list(query);
    return ok(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/leads — internal lead creation. */
export async function POST(request: NextRequest) {
  try {
    rateLimit(`leads:${clientIp(request)}`, 60, 60_000);
    const user = await requireApiUser('crm.write');
    const body = leadCreateSchema.parse(await request.json());
    const lead = await createLead(body, user);
    return ok(lead, 201);
  } catch (error) {
    if (error instanceof HttpError) return fail(error.code, error.message, error.status);
    return toErrorResponse(error);
  }
}
