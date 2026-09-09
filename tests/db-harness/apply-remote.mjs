// One-shot remote schema applier for the linked Supabase project.
// Credentials come ONLY from environment variables (PGHOST/PGPORT/PGUSER/PGPASSWORD).
// Safe to re-run: every step is idempotent.
//
// Usage (from tests/db-harness so `pg` resolves):
//   PGHOST=... PGUSER=... PGPASSWORD=... node apply-remote.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MIGRATION_FILE = path.join(ROOT, 'supabase', 'migrations', '20260909203403_initial_schema.sql');
const MIGRATION_VERSION = '20260909203403';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_AUTH_UID = process.env.ADMIN_AUTH_UID;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin';

const HOST_CANDIDATES = (process.env.PGHOST ? [process.env.PGHOST] : [
  `db.${process.env.PG_PROJECT_REF}.supabase.co`,
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
]);

const PORT = Number(process.env.PGPORT ?? 5432);
const USER = process.env.PGUSER ?? 'postgres';
const PASSWORD = process.env.PGPASSWORD;
const PROJECT_REF = process.env.PG_PROJECT_REF;

function clientFor(host) {
  return new pg.Client({
    host,
    port: PORT,
    user: PROJECT_REF && host.includes('pooler') ? `postgres.${PROJECT_REF}` : USER,
    password: PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
}

async function connectFirst() {
  for (const host of HOST_CANDIDATES) {
    const client = clientFor(host);
    try {
      await client.connect();
      console.log(`connected → ${host}:${PORT}`);
      return { client, host };
    } catch (error) {
      console.log(`connect failed → ${host}:${PORT} (${error.message.split('\n')[0]})`);
      try { await client.end(); } catch { /* ignore */ }
    }
  }
  throw new Error('Could not connect with any candidate host');
}

async function main() {
  if (!PASSWORD) throw new Error('PGPASSWORD env var is required');
  const { client, host } = await connectFirst();

  try {
    // 1. Pre-check
    const pre = await client.query("select to_regclass('public.users') as t");
    const alreadyApplied = Boolean(pre.rows[0].t);
    console.log(`schema already applied: ${alreadyApplied}`);

    // 2. Apply migration (transactional — same as `db push`)
    if (!alreadyApplied) {
      const sql = readFileSync(MIGRATION_FILE, 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('commit');
        console.log('migration applied ✓');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`migration failed: ${error.message}`);
      }
    }

    // 3. Record migration history (so a future `supabase db push` stays consistent)
    // Hosted projects don't have this schema until the CLI first runs — create it.
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text not null primary key,
        statements text[],
        name text not null
      );
    `);
    await client.query(
      'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing',
      [MIGRATION_VERSION, 'initial_schema'],
    );
    console.log('migration history recorded ✓');

    // 4. Baseline config (roles, permissions, app settings) — idempotent
    await client.query(`
      insert into public.roles (id, name, description) values
        ('00000000-0000-4000-8000-0000000000a1', 'owner',      'Full system access'),
        ('00000000-0000-4000-8000-0000000000a2', 'admin',      'CRM, users, approvals, analytics, settings'),
        ('00000000-0000-4000-8000-0000000000a3', 'sales',      'Leads, companies, contacts, customers, opportunities, tasks, follow-ups, email drafts'),
        ('00000000-0000-4000-8000-0000000000a4', 'marketing',  'Marketing data, leads, campaigns, analytics'),
        ('00000000-0000-4000-8000-0000000000a5', 'operations', 'Customers, tasks, proposals, operational workflows'),
        ('00000000-0000-4000-8000-0000000000a6', 'viewer',     'Read-only access')
      on conflict (name) do nothing;

      insert into public.permissions (id, name, description) values
        ('00000000-0000-4000-8000-0000000000b1', 'crm.read', 'Read CRM records'),
        ('00000000-0000-4000-8000-0000000000b2', 'crm.write', 'Create and update CRM records'),
        ('00000000-0000-4000-8000-0000000000b3', 'leads.delete', 'Delete lead records where authorized'),
        ('00000000-0000-4000-8000-0000000000b4', 'approvals.review', 'Approve or reject pending approval requests'),
        ('00000000-0000-4000-8000-0000000000b5', 'approvals.request', 'Create approval requests for protected actions'),
        ('00000000-0000-4000-8000-0000000000b6', 'ai.run', 'Invoke AI agents through the AI Manager'),
        ('00000000-0000-4000-8000-0000000000b7', 'knowledge.manage', 'Upload, approve, and manage company knowledge documents'),
        ('00000000-0000-4000-8000-0000000000b8', 'users.manage', 'Manage users, roles, and permissions'),
        ('00000000-0000-4000-8000-0000000000b9', 'settings.manage', 'Manage application settings'),
        ('00000000-0000-4000-8000-0000000000ba', 'analytics.read', 'Read analytics and management reports'),
        ('00000000-0000-4000-8000-0000000000bb', 'audit.read', 'Read audit logs')
      on conflict (name) do nothing;

      insert into public.app_settings (key, value, description) values
        ('email.mode', '"DRAFT_ONLY"', 'External email sending disabled; AI may create drafts only.'),
        ('ai.provider', '{"provider": "nvidia", "configured": false, "model": null}', 'AI provider status; API keys are never stored here.'),
        ('approvals.required_actions', '["outbound_sales_email", "whatsapp_message", "quotation", "proposal", "website_publish", "pricing_change", "customer_commitment"]', 'Action types that always require human approval before execution.')
      on conflict (key) do nothing;
    `);
    console.log('baseline config ✓');

    // 5. Provision the admin user (if credentials provided)
    if (ADMIN_EMAIL && ADMIN_AUTH_UID) {
      await client.query(
        `insert into public.users (auth_user_id, name, email, status)
         values ($1, $2, $3, 'active')
         on conflict (email) do update set auth_user_id = excluded.auth_user_id, status = 'active'`,
        [ADMIN_AUTH_UID, ADMIN_NAME, ADMIN_EMAIL],
      );
      await client.query(
        `insert into public.user_roles (user_id, role_id)
         select u.id, r.id from public.users u, public.roles r
         where u.email = $1 and r.name = 'owner'
         on conflict do nothing`,
        [ADMIN_EMAIL],
      );
      console.log('admin user provisioned ✓');
    }

    // 6. Verification
    const verify = await client.query(`
      select
        (select count(*) from pg_tables where schemaname = 'public')                                  as tables,
        (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity)              as tables_without_rls,
        (select count(*) from pg_policies where schemaname = 'public')                                as policies,
        (select count(*) from storage.buckets)                                                        as buckets,
        (select count(*) from public.roles)                                                           as roles,
        (select count(*) from supabase_migrations.schema_migrations where version = $1)               as migration_recorded,
        ${ADMIN_EMAIL ? `(select count(*) from public.users u join public.user_roles ur on ur.user_id = u.id join public.roles r on r.id = ur.role_id where u.email = $2 and r.name = 'owner' and u.status = 'active')` : '0'} as admin_provisioned
    `, ADMIN_EMAIL ? [MIGRATION_VERSION, ADMIN_EMAIL] : [MIGRATION_VERSION]);
    const v = verify.rows[0];
    console.log('--- VERIFICATION ---');
    console.log(`tables: ${v.tables} (expect 21)`);
    console.log(`tables without RLS: ${v.tables_without_rls} (expect 0)`);
    console.log(`policies: ${v.policies}`);
    console.log(`storage buckets: ${v.buckets} (expect 3)`);
    console.log(`roles: ${v.roles} (expect 6)`);
    console.log(`migration recorded: ${v.migration_recorded} (expect 1)`);
    if (ADMIN_EMAIL) console.log(`admin owner provisioned: ${v.admin_provisioned} (expect 1)`);
    console.log(`applied via host: ${host}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
