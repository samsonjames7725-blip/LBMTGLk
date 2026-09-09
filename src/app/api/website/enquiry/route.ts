import type { NextRequest } from 'next/server';
import { websiteEnquirySchema } from '@/validators/enquiry';
import { corsResponse, preflightResponse } from '@/security/cors';
import { toErrorResponse } from '@/security/http';
import { rateLimit, clientIp } from '@/security/rate-limit';
import { handleWebsiteEnquiry } from '@/services/lead-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/website/enquiry — public endpoint for the existing Hostinger
 * website (spec §45/§46). Validate + sanitize + rate-limit + strict CORS.
 * The live website is never modified by this project; see
 * WEBSITE-INTEGRATION.md for the integration contract.
 */
export async function OPTIONS(request: NextRequest) {
  return preflightResponse(request);
}

export async function POST(request: NextRequest) {
  try {
    // Body size guard (16 KB) before parsing.
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 16_384) {
      return corsResponse(request, { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } }, 413);
    }

    rateLimit(`enquiry:${clientIp(request)}`, 5, 60_000);

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return corsResponse(request, { success: false, error: { code: 'MALFORMED_REQUEST', message: 'Request body must be valid JSON' } }, 400);
    }

    const parsed = websiteEnquirySchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return corsResponse(
        request,
        { success: false, error: { code: 'VALIDATION_ERROR', message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input' } },
        400,
      );
    }

    const result = await handleWebsiteEnquiry(parsed.data);

    return corsResponse(request, {
      success: true,
      data: {
        received: true,
        lead_id: result.lead.id,
        created: result.created,
        lead_score: result.scoring.score,
        recommended_action: result.scoring.recommended_action,
      },
    }, 201);
  } catch (error) {
    if ((error as Error & { rateLimitRetryAfter?: number }).rateLimitRetryAfter) {
      return corsResponse(request, { success: false, error: { code: 'RATE_LIMITED', message: 'Too many enquiries. Please try again later.' } }, 429);
    }
    const response = toErrorResponse(error);
    return corsResponse(request, await response.json(), response.status);
  }
}
