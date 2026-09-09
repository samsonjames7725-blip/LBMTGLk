'use client';

/** Shared client-side fetch helper for the standard API envelope. */
export async function api<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown; formData?: FormData },
): Promise<T> {
  let response: Response;
  if (options?.formData) {
    response = await fetch(url, { method: options.method ?? 'POST', body: options.formData });
  } else {
    response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: options?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? `Request failed (${response.status})`);
  }
  return payload.data as T;
}
