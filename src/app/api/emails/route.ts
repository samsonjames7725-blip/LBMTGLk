import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { emailRepository } from '@/repositories/supabase';
import { isEmailConfigured } from '@/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/emails — list by status. The system stays in DRAFT_ONLY mode:
 * external sending is disabled until the delivery layer is implemented.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const emails = await emailRepository.list({
      status: (status as Parameters<typeof emailRepository.list>[0] extends { status?: infer S } ? S : never) ?? undefined,
      limit: 200,
    });
    return ok({
      items: emails,
      total: emails.length,
      sending_mode: 'DRAFT_ONLY',
      smtp: isEmailConfigured() ? 'configured' : 'not_configured',
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
