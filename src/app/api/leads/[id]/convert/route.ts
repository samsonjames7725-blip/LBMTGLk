import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { convertLead } from '@/services/lead-service';

export const dynamic = 'force-dynamic';

/** POST /api/leads/:id/convert — lead → company + contact + customer + opportunity. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser('crm.write');
    const { id } = await params;
    const result = await convertLead(id, user);
    return ok(result, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
