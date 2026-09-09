import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { approvalRepository } from '@/repositories/supabase';
import type { Approval } from '@/types/database';

export const dynamic = 'force-dynamic';

/** GET /api/approvals — list by status tab. */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const statusParam = request.nextUrl.searchParams.get('status');
    const status = APPROVAL_STATUSES.includes(statusParam as Approval['status'])
      ? (statusParam as Approval['status'])
      : undefined;
    const approvals = await approvalRepository.list({ status, limit: 200 });
    return ok({ items: approvals, total: approvals.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const APPROVAL_STATUSES: Approval['status'][] = ['pending', 'approved', 'rejected', 'executed'];
