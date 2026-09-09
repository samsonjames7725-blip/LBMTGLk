import type { NextRequest } from 'next/server';
import { aiCommandSchema } from '@/validators/work';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, RateLimitError } from '@/security/http';
import { rateLimit, clientIp } from '@/security/rate-limit';
import { runAICommand } from '@/ai/manager';

export const dynamic = 'force-dynamic';

/** POST /api/ai — AI Manager entry point (spec §29). Authenticated + rate limited. */
export async function POST(request: NextRequest) {
  try {
    rateLimit(`ai:${clientIp(request)}`, 20, 60_000);
    const user = await requireApiUser();
    const body = aiCommandSchema.parse(await request.json());
    const response = await runAICommand(body.command, user);
    return ok(response);
  } catch (error) {
    if ((error as Error & { rateLimitRetryAfter?: number }).rateLimitRetryAfter) {
      return toErrorResponse(new RateLimitError());
    }
    return toErrorResponse(error);
  }
}
