import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, fail } from '@/security/http';
import { getDashboardData } from '@/services/dashboard-service';
import { ConfigurationError } from '@/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard — KPIs and activity for the executive dashboard. */
export async function GET() {
  try {
    await requireApiUser('crm.read');
    const data = await getDashboardData();
    return ok(data);
  } catch (error) {
    if (error instanceof ConfigurationError || (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED')) {
      return fail('CONFIGURATION_ERROR', 'Database is not configured', 503);
    }
    return toErrorResponse(error);
  }
}
