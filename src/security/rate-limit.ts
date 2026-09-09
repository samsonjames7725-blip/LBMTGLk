import type { NextRequest } from 'next/server';

// In-memory fixed-window rate limiter. Honest scope (spec §66): this protects
// each server instance only — it is NOT globally distributed. On serverless
// Vercel, every warm instance enforces its own window; abuse protection at
// the edge (e.g. Vercel WAF) should complement this.

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

// Periodically drop expired windows so the map does not grow unbounded.
let lastSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, state] of windows) {
      if (state.resetAt <= now) windows.delete(k);
    }
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const error = new Error(`Rate limit exceeded. Retry in ${retryAfterSec}s`) as Error & { rateLimitRetryAfter?: number };
    error.rateLimitRetryAfter = retryAfterSec;
    throw error;
  }
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
