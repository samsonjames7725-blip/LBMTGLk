import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class ConfigurationError extends Error {
  readonly code = 'CONFIGURATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY);
}

export function isEmailConfigured(): boolean {
  const host = process.env.HOSTINGER_SMTP_HOST ?? process.env.SMTP_HOST;
  const user = process.env.HOSTINGER_SMTP_USER ?? process.env.SMTP_USER;
  return Boolean(host && user);
}

/**
 * Service-layer client using the server-only secret key. Bypasses RLS by
 * design — every call site must have passed through the server-side
 * authorization layer first. Never import this module from client code.
 */
export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new ConfigurationError('Database is not configured (missing SUPABASE_SECRET_KEY)');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lazily-cached admin client for read-heavy pages. Returns null when the
 * platform is not configured so pages can render honest "not configured"
 * states instead of crashing.
 */
let cachedAdmin: SupabaseClient | null = null;

export function tryGetAdminClient(): SupabaseClient | null {
  if (!isDatabaseConfigured()) return null;
  if (!cachedAdmin) cachedAdmin = getAdminClient();
  return cachedAdmin;
}
