import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Error with a safe, client-visible message and an HTTP status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Request validation failed') {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class RateLimitError extends HttpError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Maps any thrown error to the standard safe error envelope. */
export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return fail('VALIDATION_ERROR', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', 400);
  }
  if (error instanceof HttpError) {
    return fail(error.code, error.message, error.status);
  }
  // Unexpected errors are logged server-side only; clients get a safe message.
  console.error('[api] unhandled error', error instanceof Error ? { message: error.message } : error);
  return fail('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
