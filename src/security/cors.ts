import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS for the public website-enquiry endpoint (spec §65). Only origins from
 * ALLOWED_ENQUIRY_ORIGINS (comma-separated) or NEXT_PUBLIC_APP_URL are
 * allowed. Never uses "*" for this endpoint.
 */
export function allowedEnquiryOrigins(): string[] {
  return (process.env.ALLOWED_ENQUIRY_ORIGINS ?? process.env.NEXT_PUBLIC_APP_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return allowedEnquiryOrigins().includes(origin);
}

export function corsResponse(request: NextRequest, body: unknown, status = 200): NextResponse {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {};
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Vary'] = 'Origin';
  }
  return NextResponse.json(body, { status, headers });
}

export function preflightResponse(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Vary'] = 'Origin';
  }
  return new NextResponse(null, { status: 204, headers });
}
