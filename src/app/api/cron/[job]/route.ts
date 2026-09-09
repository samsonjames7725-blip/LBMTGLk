import type { NextRequest } from 'next/server';
import { ok, toErrorResponse, fail } from '@/security/http';
import { AUTOMATION_JOBS, runAutomationWithLogging, type AutomationJob } from '@/services/automation/jobs';
import { isDatabaseConfigured } from '@/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/cron/:job — Vercel Cron entry points (spec §62). Protected
 * with a Bearer CRON_SECRET; never publicly callable. Jobs perform internal
 * actions only (tasks, drafts, alerts, record updates).
 */
async function handle(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  try {
    const { job } = await params;
    if (!AUTOMATION_JOBS.includes(job as AutomationJob)) {
      return fail('NOT_FOUND', `Unknown automation job: ${job}`, 404);
    }

    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    if (!secret || auth !== `Bearer ${secret}`) {
      return fail('UNAUTHORIZED', 'Invalid cron credentials', 401);
    }
    if (!isDatabaseConfigured()) {
      return fail('CONFIGURATION_ERROR', 'Database is not configured', 503);
    }

    const { runId, result } = await runAutomationWithLogging(job as AutomationJob);
    return ok({ automation_run_id: runId, result });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ job: string }> }) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ job: string }> }) {
  return handle(request, context);
}
