# ARCHITECTURE

## Layered request flow

```text
UI (server components + small client islands)
        ↓
REST API route handlers  (app/api/**)  — also the public contract for the website
        ↓
Authorization  (src/auth/session.ts + src/auth/permissions.ts)
        ↓
Business services  (src/services/**, src/ai/**)
        ↓
Repositories  (src/repositories/interfaces → Supabase implementations)
        ↓
Supabase (PostgreSQL + RLS, Auth, Storage)
        ↘
          NVIDIA / Gemini providers (src/ai/provider.ts, src/ai/gemini.ts)
```

Rules enforced by convention and code review:

- UI components contain no business logic and no database access.
- All database access goes through repositories; services own business rules.
- AI agents never touch the network or UI directly — they receive an
  `AIProvider` and repositories.
- Every API input is validated with Zod (`src/validators`).
- Every protected mutation is audit-logged (`src/services/audit-service.ts`).

## Data model

21 tables, all with RLS (see DATABASE.md for the schema and the offline
verification harness):

- Identity: `users` (1:1 with `auth.users`), `roles`, `permissions`, `user_roles`
- CRM: `companies`, `contacts`, `leads`, `customers`, `opportunities`, `interactions`
- Work: `tasks`, `followups`, `emails`, `proposals`, `approvals`
- Intelligence: `agent_runs`, `automation_runs`, `knowledge_documents`, `knowledge_chunks`
- Governance: `audit_logs`, `app_settings`

## Authorization model

Two layers, both required:

1. **Server-side RBAC** — `getSessionUser()` resolves the Supabase Auth user
   to an active `users` row with roles; `ROLE_PERMISSIONS` maps
   owner/admin/sales/marketing/operations/viewer to permissions. Route
   handlers call `requireApiUser(permission)` before doing anything.
2. **Database RLS** — deny-by-default. `anon` has no grants; `authenticated`
   gets SELECT-only, filtered by policies; the server's service-role client
   (`SUPABASE_SECRET_KEY`) bypasses RLS and is only reachable from the
   server-side service layer.

## AI orchestration

`POST /api/ai` → AI Manager (`src/ai/manager.ts`):

```text
command → intent classification (provider, keyword fallback)
        → permission check (per task type)
        → agent selection (lead | sales | followup | email)
        → context retrieval (authorized data + APPROVED knowledge only)
        → execution (agent)
        → agent_runs record + audit log
        → structured response { command, agent, status, result,
            recommended_actions, approval_required }
```

Protected actions raise an approval request (`approvals` table) which a human
reviews in the Approval Center. External sending actions raise an honest
501 `NOT_IMPLEMENTED` while the delivery layer does not exist.

## Provider abstraction

`AIProvider` (generateText, classify, structuredOutput, optional embed) is
implemented by `NVIDIAProvider` (OpenAI-compatible REST, primary per spec),
`GeminiProvider` (Google Generative Language API), and a deterministic
`StubProvider` used when neither key is configured. The factory picks
NVIDIA → Gemini → stub; every output from the stub is clearly marked.
