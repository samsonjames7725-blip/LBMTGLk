# ENVIRONMENT

All configuration comes from environment variables. Secrets are server-only:
they are never sent to the browser, never logged, never committed, and never
placed in `NEXT_PUBLIC_*` variables. `.env.example` documents the same list
without values.

## Public (safe for the browser)

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — all clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key for auth/session clients |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin (CORS allow-list for the enquiry endpoint) |

## Server-only

| Variable | Used for |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Service-layer database client (bypasses RLS; server code only) |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL` | NVIDIA AI provider (primary; OpenAI-compatible REST) |
| `GEMINI_API_KEY` | Google Gemini provider (secondary; used when NVIDIA is unset) |
| `GEMINI_MODEL`, `GEMINI_FAST_MODEL`, `GEMINI_REASONING_MODEL`, `GEMINI_EMBEDDING_MODEL` | Gemini model registry overrides |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (aliases `HOSTINGER_SMTP_*`) | Future email delivery — **DRAFT_ONLY mode: not used for sending yet** |
| `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD` (aliases `HOSTINGER_IMAP_*`) | Future inbound email |
| `CRON_SECRET` | Bearer secret protecting `/api/cron/*` |
| `ALLOWED_ENQUIRY_ORIGINS` | Comma-separated origins allowed to POST `/api/website/enquiry` |

## Behavior when values are missing

- No `SUPABASE_SECRET_KEY` → pages render “NOT CONFIGURED” states; APIs return
  `CONFIGURATION_ERROR` (503); nothing crashes.
- No AI key → deterministic stub provider with clearly marked outputs;
  structured output refuses to fabricate data.
- No `CRON_SECRET` → cron endpoints reject every request (401).
- No `ALLOWED_ENQUIRY_ORIGINS`/`NEXT_PUBLIC_APP_URL` → enquiry CORS headers
  are never emitted (browser cross-origin calls fail closed).

## Rules

1. Never commit `.env`, `.env.local`, or any real secret.
2. Never reference server-only variables from client components.
3. Rotation: change the value in Vercel (or your host) and redeploy.
