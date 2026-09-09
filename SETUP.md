# SETUP

## 1. Prerequisites

- Node.js 20+ and npm
- A Supabase account with access to project `ghvjdybgllufjtdurbvh`
- (Optional, for remote DB operations) Supabase CLI: `npx supabase --version`

## 2. Install

```bash
npm install
cp .env.example .env.local   # then fill values (see ENVIRONMENT.md)
```

Minimum required to run with a live database:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ghvjdybgllufjtdurbvh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<server-only secret key>
```

## 3. Apply the database schema (once)

The CLI cannot log in from non-interactive shells, so run the login yourself:

```bash
npx supabase login                                     # opens the browser
npx supabase link --project-ref ghvjdybgllufjtdurbvh
npx supabase migration list                            # inspect remote state first
npx supabase db push                                   # applies supabase/migrations/*
```

The initial migration is strictly additive (no DROPs) and creates all tables,
indexes, constraints, RLS policies, and the three private storage buckets.
Verify offline first: `npm run db:verify` (34 checks, no cloud access).

## 4. Provision the first user

Authentication uses Supabase Auth; access additionally requires a matching
active row in the `users` table:

1. Create the auth user in Supabase Dashboard → Authentication → Users
   (email + password, confirm the email).
2. Copy the auth user's UUID, then in Dashboard → SQL Editor:

   ```sql
   insert into public.users (auth_user_id, name, email, status)
   values ('<auth-user-uuid>', 'Your Name', 'you@lifebridgemedtech.com', 'active');

   -- grant the owner role
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id from public.users u, public.roles r
   where u.email = 'you@lifebridgemedtech.com' and r.name = 'owner';
   ```

3. Sign in at `/login`. Unprovisioned auth accounts are rejected at login with
   a clear message.

## 5. Local development

```bash
npm run dev
```

Without `SUPABASE_SECRET_KEY` the UI renders honest “NOT CONFIGURED” states
instead of crashing. Without an AI key the AI agents use the deterministic
stub (clearly marked outputs).

## 6. Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 7. Make a schema change

```bash
npx supabase migration new <descriptive_name>   # write additive SQL
npm run db:verify                               # offline verification
npx supabase db push                            # apply to the linked project
cat supabase/migrations/*.sql > supabase/schema.sql   # refresh reference
```

Migrations are immutable once pushed. Never write destructive SQL.
