import { ok, toErrorResponse } from '@/security/http';
import { isAiConfigured, isDatabaseConfigured } from '@/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /health — safe status only, never credentials (spec §88). */
export async function GET() {
  try {
    return ok({
      status: 'ok',
      database: isDatabaseConfigured() ? 'configured' : 'not_configured',
      ai: isAiConfigured() ? 'configured' : 'not_configured',
      environment: process.env.NODE_ENV ?? 'development',
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
