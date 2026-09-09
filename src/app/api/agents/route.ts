import type { NextRequest } from 'next/server';
import { ok, toErrorResponse } from '@/security/http';
import { AGENT_REGISTRY } from '@/ai/manager';
import { getAIProvider } from '@/ai/provider';

export const dynamic = 'force-dynamic';

/** GET /api/agents — registry with honest implementation status. */
export async function GET(_request: NextRequest) {
  try {
    const provider = getAIProvider();
    return ok({
      agents: AGENT_REGISTRY,
      provider: { name: provider.name, configured: provider.configured, model: provider.model },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
