import type { NextRequest } from 'next/server';
import { followupCreateSchema, followupUpdateSchema } from '@/validators/work';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { followupRepository } from '@/repositories/supabase';
import type { Followup } from '@/types/database';

export const dynamic = 'force-dynamic';

/** GET /api/followups — list by bucket (today/upcoming/overdue/completed). */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const bucket = request.nextUrl.searchParams.get('bucket') ?? 'pending';
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    let items;
    if (bucket === 'completed') {
      items = await followupRepository.list({ status: 'completed', limit: 100 });
    } else if (bucket === 'overdue') {
      items = await followupRepository.list({ status: ['pending', 'overdue'] as never, scheduledTo: dayStart, limit: 100 });
    } else if (bucket === 'today') {
      items = await followupRepository.list({ status: 'pending', scheduledFrom: dayStart, scheduledTo: dayEnd, limit: 100 });
    } else {
      items = await followupRepository.list({ status: 'pending', scheduledFrom: dayEnd, limit: 100 });
    }
    return ok({ bucket, items, total: items.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/followups — schedule a follow-up. */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser('crm.write');
    const body = followupCreateSchema.parse(await request.json());
    const followup = await followupRepository.create({
      ...body,
      scheduled_at: body.scheduled_at ?? new Date().toISOString(),
      status: 'pending',
    });
    return ok(followup, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/followups?id= — complete / reschedule / reassign. */
export async function PATCH(request: NextRequest) {
  try {
    await requireApiUser('crm.write');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return toErrorResponse(new Error('id query parameter is required'));
    const body = followupUpdateSchema.parse(await request.json());
    const patch: Partial<Followup> = { ...body };
    if (body.status === 'completed') patch.completed_at = new Date().toISOString();
    const followup = await followupRepository.update(id, patch);
    return ok(followup);
  } catch (error) {
    return toErrorResponse(error);
  }
}
