# DATABASE.md — LifeBridge MedTech AI Business OS

Linked Supabase project (do not create another):

```text
Project ref: ghvjdybgllufjtdurbvh
Project URL: https://ghvjdybgllufjtdurbvh.supabase.co
```

## File layout

```text
supabase/
├── config.toml                  # Supabase CLI config (project_id: LBMT)
├── migrations/
│   └── 20260909203403_initial_schema.sql   # Source of truth for the schema
├── schema.sql                   # Consolidated reference (generated — do not edit)
└── seed.sql                     # Dev/demo seed — applied by `db reset` only
tests/db-harness/                # Local migration verification harness (offline)
```

`schema.sql` is generated with:

```bash
cat supabase/migrations/*.sql > supabase/schema.sql
```

The migration files are authoritative. Never edit `schema.sql` directly.

## What the initial migration creates

- **RBAC**: `users` (linked to `auth.users`), `roles`, `permissions`, `user_roles`
- **CRM**: `companies`, `contacts`, `leads`, `customers`, `opportunities`, `interactions`
- **Work**: `tasks`, `followups`, `approvals`, `emails`, `proposals`
- **AI & governance**: `agent_runs`, `audit_logs`, `automation_runs`
- **Knowledge**: `knowledge_documents`, `knowledge_chunks` (full-text searchable)
- **Settings**: `app_settings` (values only — secrets never stored here)
- **Storage buckets** (all private): `company-knowledge`, `proposals`, `internal-files`
- Indexes on the common search/filter columns, CHECK constraints for every
  status/enum-style field, `updated_at` triggers, and RLS on every table.

The migration is strictly additive — it contains no `DROP`/`ALTER` of any
existing object, so applying it to the linked project cannot destroy
production data. If the project already contains a table with the same name,
the push fails loudly instead of overwriting anything.

## Security model

- **RLS is enabled on all 21 tables** (deny-by-default).
- `anon`: no grants at all.
- `authenticated`: SELECT only, filtered by policies — active app users see
  shared CRM data; `users`/`user_roles` rows are restricted to self unless
  owner/admin; `audit_logs` is owner/admin only; pending knowledge documents
  are hidden from non-admins.
- `service_role` (server-side app layer, `SUPABASE_SECRET_KEY`): full access,
  bypasses RLS. All writes go through the server-side authorization layer —
  the browser can never write directly.
- Helper functions live in the `private` schema (not exposed via the Data
  API), are `SECURITY DEFINER`, and are granted only to
  `authenticated`/`service_role`.
- No database passwords or connection strings exist anywhere in the repo.
  Credentials are supplied only through environment variables
  (`SUPABASE_SECRET_KEY` etc.) and are never placed in `NEXT_PUBLIC_*`.

## Applying to the linked project

The CLI cannot log in from non-interactive shells, so run the login yourself
once (or set `SUPABASE_ACCESS_TOKEN` from https://supabase.com/dashboard/account/tokens):

```bash
npx supabase login                 # opens the browser
npx supabase link --project-ref ghvjdybgllufjtdurbvh
npx supabase migration list        # confirm remote history is empty/expected
npx supabase db push               # applies supabase/migrations/*
```

`db push` applies each migration atomically and records it in the remote
migration history. It does **not** run `seed.sql` — demo data never reaches
production.

Then verify on the remote:

```bash
npx supabase migration list                    # migration marked as applied
# Dashboard → Table Editor / Database → confirm tables, RLS, storage buckets
```

## Testing changes locally (before pushing)

The repo includes an offline harness that boots a throwaway embedded
PostgreSQL, stubs the Supabase environment (`auth`/`storage` schemas, Data API
roles, cloud default privileges), applies the migrations and seed, and runs
34 structural + RLS behavior checks:

```bash
cd tests/db-harness
npm install
npm test
```

It never connects to the hosted project. `npm test` must pass before any
migration is pushed.

## Making schema changes

```bash
npx supabase migration new <descriptive_name>   # creates a timestamped file
# edit the new file — additive changes only, never destructive
cd tests/db-harness && npm test                 # verify locally
npx supabase db push                            # apply to the linked project
cat supabase/migrations/*.sql > supabase/schema.sql   # refresh reference
```

Rules:

1. New migration files are never edited once pushed.
2. No destructive operations (no `DROP TABLE/COLUMN` of business data, no
   data deletion) — matching the project's data-preservation requirements.
3. Every new table gets RLS enabled, at least one policy, and explicit grants.

## Seed data policy

`supabase/seed.sql` inserts roles, baseline permissions, default
`app_settings`, and `[DEMO]`-marked example records. Demo users are
`inactive` with no linked auth account, so they can never sign in. Seed is
applied only by `supabase db reset` in local development.
