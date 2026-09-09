import type { NextRequest } from 'next/server';
import { taskCreateSchema, taskUpdateSchema } from '@/validators/work';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { taskRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/tasks — list with optional filters. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser('crm.read');
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const mine = request.nextUrl.searchParams.get('mine') === 'true';
    const tasks = await taskRepository.list({
      status: (status as Parameters<typeof taskRepository.list>[0] extends { status?: infer S } ? S : never) ?? undefined,
      assignedTo: mine ? user.appUser.id : undefined,
      limit: 200,
    });
    return ok({ items: tasks, total: tasks.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/tasks — create a task. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser('crm.write');
    const body = taskCreateSchema.parse(await request.json());
    const task = await taskRepository.create({
      ...body,
      assigned_to: body.assigned_to ?? user.appUser.id,
      status: 'todo',
    });
    return ok(task, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/tasks?id= — update status/priority. */
export async function PATCH(request: NextRequest) {
  try {
    await requireApiUser('crm.write');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return toErrorResponse(new Error('id query parameter is required'));
    const body = taskUpdateSchema.parse(await request.json());
    const task = await taskRepository.update(id, body);
    return ok(task);
  } catch (error) {
    return toErrorResponse(error);
  }
}
