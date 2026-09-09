import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, fail } from '@/security/http';
import { getAnalytics } from '@/services/analytics-service';
import { ConfigurationError } from '@/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/analytics — real database aggregates (spec §58). */
export async function GET() {
  try {
    await requireApiUser('analytics.read');
    const data = await getAnalytics();
    return ok(data);
  } catch (error) {
    if (error instanceof ConfigurationError || (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED')) {
      return fail('CONFIGURATION_ERROR', 'Database is not configured', 503);
    }
    return toErrorResponse(error);
  }
}
