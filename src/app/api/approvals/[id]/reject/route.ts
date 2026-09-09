import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { reject } from '@/services/approval-service';

export const dynamic = 'force-dynamic';

/** POST /api/approvals/:id/reject — requires approvals.review. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser('approvals.review');
    const { id } = await params;
    const approval = await reject(id, user);
    return ok(approval);
  } catch (error) {
    return toErrorResponse(error);
  }
}
