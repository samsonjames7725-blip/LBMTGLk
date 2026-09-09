import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { execute } from '@/services/approval-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/approvals/:id/execute — executes an approved action (internal
 * record updates only). External communication actions raise an honest
 * NOT_IMPLEMENTED error while the system is in DRAFT_ONLY mode.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser('approvals.review');
    const { id } = await params;
    const approval = await execute(id, user);
    return ok(approval);
  } catch (error) {
    return toErrorResponse(error);
  }
}
