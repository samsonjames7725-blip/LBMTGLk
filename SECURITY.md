# SECURITY

## Authentication

- Supabase Auth (email/password) with cookie-based sessions via `@supabase/ssr`.
- `src/middleware.ts` protects every page and API route except
  `/login`, `/api/website/enquiry`, `/api/cron/*`, `/api/health`, and static assets.
- A valid auth session is necessary but NOT sufficient: `getSessionUser()`
  requires a matching **active** row in `public.users`. Unprovisioned or
  deactivated accounts are rejected server-side.

## Authorization (RBAC)

- Roles: `owner`, `admin`, `sales`, `marketing`, `operations`, `viewer`.
- `src/auth/permissions.ts` maps roles to permissions; checks happen in route
  handlers (`requireApiUser('crm.write')`) — never in the browser.
- The AI layer is subject to the same permission matrix; the AI cannot grant
  itself permissions (manager checks before every agent run).

## Row Level Security (database)

- RLS enabled on all 21 public tables, deny-by-default.
- `anon`: no table grants. `authenticated`: SELECT only, filtered by policies
  (self-only profile; owner/admin-only audit logs; pending knowledge hidden
  from non-admins). `service_role`: full access, used exclusively by the
  server-side service layer.
- Helper functions live in the non-exposed `private` schema, are
  `SECURITY DEFINER`, and are granted only to `authenticated`/`service_role`.
- Verified by the offline harness: unknown users see nothing; anon is denied;
  authenticated inserts are denied; service_role bypasses (34 checks total).

## Human approval workflow

Protected action types (`outbound_sales_email`, `whatsapp_message`,
`quotation`, `proposal`, `website_publish`, `pricing_change`,
`customer_commitment`) require an `approvals` record reviewed by a human with
`approvals.review` before execution. External sending actions fail with 501
`NOT_IMPLEMENTED` while the delivery layer does not exist.

## Input handling

- Every API body/query is parsed with Zod (`src/validators`).
- Free text is stripped of control characters and length-capped.
- The public enquiry endpoint: 16 KB body cap, malformed JSON rejection,
  5 requests/minute/IP in-memory rate limit, strict CORS allow-list
  (`ALLOWED_ENQUIRY_ORIGINS`), no wildcard origins, safe error envelopes.
- General rate limiting (in-memory, per-instance — honestly documented) on
  `/api/ai` and lead creation.

## Errors & logging

- Standard envelope: `{ success, data }` / `{ success, error: { code, message } }`.
- Unexpected errors log details server-side only; clients receive safe
  messages. No stack traces, paths, credentials, or SQL ever leave the server.
- Audit logs (`audit_logs`) record actor, action, entity, entity id, metadata
  and never contain secrets.

## Secret management

- `SUPABASE_SECRET_KEY`, DB passwords, AI keys, SMTP/IMAP passwords and
  `CRON_SECRET` exist only as environment variables on the server.
- The PostgreSQL connection string is never stored in the repo or docs.
- `.gitignore` covers `.env*`, `.vercel/`, `supabase/.temp/`, test data.
