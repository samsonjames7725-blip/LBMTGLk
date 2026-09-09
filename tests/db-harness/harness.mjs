// =============================================================================
// LifeBridge MedTech — local migration verification harness
// =============================================================================
// Boots a throwaway embedded PostgreSQL, replicates the minimal Supabase
// environment (auth + storage schemas, Data API roles, cloud default
// privileges), applies supabase/migrations/*.sql and supabase/seed.sql, then
// verifies structure, privileges, RLS behavior, and constraints.
//
// This harness NEVER connects to the hosted Supabase project.
// Run with:  npm test   (inside tests/db-harness)
// =============================================================================

import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const SEED_FILE = path.join(ROOT, 'supabase', 'seed.sql');
const DATA_DIR = path.join(import.meta.dirname, 'pgdata');
const PORT = 54330;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const expectError = async (name, fn, wantedCode) => {
  try {
    await fn();
    check(name, false, `expected error ${wantedCode}, but statement succeeded`);
  } catch (e) {
    check(name, e.code === wantedCode, `got ${e.code ?? 'no-code'}: ${String(e.message).slice(0, 120)}`);
  }
};

const q = (client, sql, params) => client.query(sql, params);
const one = async (client, sql, params = []) => (await q(client, sql, params)).rows[0];
const scalar = async (client, sql, params = []) => {
  const r = await one(client, sql, params);
  return r ? Object.values(r)[0] : undefined;
};

// Fixture IDs (never used in production — local throwaway DB only)
const AUTH_SALES = '11111111-1111-4111-8111-111111111111';
const AUTH_ADMIN = '22222222-2222-4222-8222-222222222222';
const AUTH_STRANGER = '99999999-9999-4999-8999-999999999999';
const USER_SALES = 'aaaaaaaa-0000-4000-8000-00000000aa01';
const USER_ADMIN = 'aaaaaaaa-0000-4000-8000-00000000aa02';
const FIX_COMPANY = 'aaaaaaaa-0000-4000-8000-00000000bb01';
const FIX_LEAD = 'aaaaaaaa-0000-4000-8000-00000000cc01';

async function asRole(client, role, jwtSub) {
  await q(client, `set role ${role}`);
  if (jwtSub === null) {
    await q(client, `select set_config('request.jwt.claims', '', false)`);
  } else if (jwtSub) {
    await q(client, `select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: jwtSub })]);
  }
}
async function resetRole(client) {
  await q(client, `reset role`);
  await q(client, `select set_config('request.jwt.claims', '', false)`);
}

async function main() {
  const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  if (migrations.length === 0) throw new Error('no migration files found');
  console.log(`Migrations to apply: ${migrations.join(', ')}\n`);

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'local-only-harness',
    port: PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('lbmt_test');

  const client = new Client({
    host: '127.0.0.1',
    port: PORT,
    user: 'postgres',
    password: 'local-only-harness',
    database: 'lbmt_test',
  });
  await client.connect();

  try {
    // ------------------------------------------------------------------
    // 1. Stub the Supabase environment (what the hosted project provides)
    // ------------------------------------------------------------------
    await q(client, `
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create role authenticator nologin;
      grant usage on schema public to anon, authenticated, service_role;

      create schema auth;
      create table auth.users (
        id uuid primary key default gen_random_uuid(),
        email text unique,
        created_at timestamptz not null default now()
      );
      create function auth.uid() returns uuid language sql stable as $f$
        select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
      $f$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant select on auth.users to service_role;
      grant execute on function auth.uid() to public;

      create schema storage;
      create table storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false,
        file_size_limit bigint,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets (id),
        name text,
        owner uuid,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated, service_role;
      grant all on storage.buckets to service_role;
      grant select on storage.buckets to anon, authenticated;
      grant all on storage.objects to service_role;

      -- Replicate Supabase cloud defaults: tables created by postgres get
      -- privileges for the Data API roles. The migration is expected to
      -- revoke these and re-grant deliberately.
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    `);
    check('Supabase stub environment created', true);

    // ------------------------------------------------------------------
    // 2. Apply migrations (transactional, like `supabase db push`)
    // ------------------------------------------------------------------
    await q(client, 'begin');
    try {
      for (const file of migrations) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await q(client, sql);
      }
      await q(client, 'commit');
      check('All migrations apply cleanly', true);
    } catch (e) {
      await q(client, 'rollback');
      check('All migrations apply cleanly', false, `${e.code ?? ''} ${e.message} (position ${e.position})`);
      throw e;
    }

    // ------------------------------------------------------------------
    // 3. Structural verification
    // ------------------------------------------------------------------
    const EXPECTED_TABLES = [
      'users', 'roles', 'permissions', 'user_roles', 'companies', 'contacts',
      'leads', 'customers', 'opportunities', 'interactions', 'tasks', 'followups',
      'approvals', 'emails', 'proposals', 'agent_runs', 'audit_logs',
      'automation_runs', 'knowledge_documents', 'knowledge_chunks', 'app_settings',
    ];
    const tables = (
      await q(client, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
    ).rows.map((r) => r.table_name);
    const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
    const extra = tables.filter((t) => !EXPECTED_TABLES.includes(t));
    check(
      `All ${EXPECTED_TABLES.length} expected tables exist`,
      missing.length === 0 && extra.length === 0,
      missing.length ? `missing: ${missing.join(', ')}` : extra.length ? `unexpected: ${extra.join(', ')}` : '',
    );

    const noRls = (
      await q(client, `
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
    ).rows.map((r) => r.relname);
    check('RLS enabled on every public table', noRls.length === 0, noRls.join(', '));

    const tablesWithoutPolicy = (
      await q(client, `
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`)
    ).rows.map((r) => r.relname);
    check('Every public table has at least one policy', tablesWithoutPolicy.length === 0, tablesWithoutPolicy.join(', '));

    const EXPECTED_INDEXES = [
      'idx_leads_status', 'idx_leads_temperature', 'idx_leads_score', 'idx_leads_next_followup',
      'idx_leads_created_at', 'idx_opportunities_stage', 'idx_opportunities_owner',
      'idx_opportunities_close_date', 'idx_tasks_status', 'idx_tasks_due_date',
      'idx_followups_status', 'idx_followups_scheduled_at', 'idx_agent_runs_agent_name',
      'idx_agent_runs_created_at', 'idx_audit_logs_created_at', 'idx_knowledge_chunks_search',
    ];
    const indexes = (await q(client, `select indexname from pg_indexes where schemaname = 'public'`)).rows.map((r) => r.indexname);
    const missingIdx = EXPECTED_INDEXES.filter((i) => !indexes.includes(i));
    check('Key indexes exist', missingIdx.length === 0, missingIdx.join(', '));

    const privs = await one(client, `
      select
        has_table_privilege('authenticated', 'public.leads', 'SELECT')      as auth_select,
        has_table_privilege('authenticated', 'public.leads', 'INSERT')      as auth_insert,
        has_table_privilege('authenticated', 'public.audit_logs', 'SELECT') as auth_audit_select,
        has_table_privilege('anon', 'public.leads', 'SELECT')               as anon_select,
        has_table_privilege('service_role', 'public.leads', 'INSERT')       as service_insert
    `);
    check(
      'Privileges: authenticated read-only, anon none, service_role full',
      privs.auth_select && !privs.auth_insert && privs.auth_audit_select && !privs.anon_select && privs.service_insert,
      JSON.stringify(privs),
    );

    const trgCount = Number(
      await scalar(client, `select count(*) from pg_trigger where tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace) and tgname like 'trg_%_updated_at' and not tgisinternal`),
    );
    check('updated_at triggers installed (11)', trgCount === 11, `found ${trgCount}`);

    const buckets = (await q(client, `select id from storage.buckets order by id`)).rows.map((r) => r.id);
    check(
      'Storage buckets created (private)',
      JSON.stringify(buckets) === JSON.stringify(['company-knowledge', 'internal-files', 'proposals']),
      buckets.join(', '),
    );
    const storagePolicies = Number(await scalar(client, `select count(*) from pg_policies where schemaname = 'storage'`));
    check('Storage policies installed (>=3)', storagePolicies >= 3, `found ${storagePolicies}`);

    const fkCounts = await one(client, `
      select
        (select count(*) from pg_constraint where conrelid = 'public.opportunities'::regclass and contype = 'f') as opp,
        (select count(*) from pg_constraint where conrelid = 'public.emails'::regclass and contype = 'f')         as emails,
        (select count(*) from pg_constraint where conrelid = 'public.interactions'::regclass and contype = 'f')   as interactions
    `);
    check(
      'Foreign keys present (opportunities>=3, emails>=4, interactions>=6)',
      Number(fkCounts.opp) >= 3 && Number(fkCounts.emails) >= 4 && Number(fkCounts.interactions) >= 6,
      JSON.stringify(fkCounts),
    );

    // ------------------------------------------------------------------
    // 4. Fixtures for RLS behavior tests
    // ------------------------------------------------------------------
    await q(client, `
      insert into auth.users (id, email) values
        ('${AUTH_SALES}', 'sales@test.local'),
        ('${AUTH_ADMIN}', 'admin@test.local');

      -- Base roles exist independently of seed.sql (fixtures must not depend on it)
      insert into public.roles (name, description) values
        ('owner', 'harness'), ('admin', 'harness'), ('sales', 'harness'),
        ('marketing', 'harness'), ('operations', 'harness'), ('viewer', 'harness');

      insert into public.users (id, auth_user_id, name, email, status) values
        ('${USER_SALES}', '${AUTH_SALES}', 'Test Sales', 'sales@test.local', 'active'),
        ('${USER_ADMIN}', '${AUTH_ADMIN}', 'Test Admin', 'admin@test.local', 'active');

      insert into public.user_roles (user_id, role_id)
        select '${USER_SALES}', id from public.roles where name = 'sales';
      insert into public.user_roles (user_id, role_id)
        select '${USER_ADMIN}', id from public.roles where name = 'admin';

      insert into public.companies (id, name, status) values ('${FIX_COMPANY}', 'Harness Test Clinic', 'prospect');
      insert into public.leads (id, company, company_id, status, lead_score, lead_temperature)
        values ('${FIX_LEAD}', 'Harness Test Clinic', '${FIX_COMPANY}', 'new', 50, 'warm');
      insert into public.customers (id, company_id, customer_status) values (gen_random_uuid(), '${FIX_COMPANY}', 'active');
      insert into public.audit_logs (action, entity) values ('harness.test_event', 'harness');
      insert into public.knowledge_documents (filename, category, storage_path, approval_status)
        values ('pending-doc.md', 'faqs', 'company-knowledge/harness/pending-doc.md', 'pending');
    `);

    // ------------------------------------------------------------------
    // 5. RLS behavior
    // ------------------------------------------------------------------
    await asRole(client, 'authenticated', AUTH_STRANGER);
    check('Unknown auth user sees 0 leads', Number(await scalar(client, `select count(*) from public.leads`)) === 0);
    check('Unknown auth user sees 0 companies', Number(await scalar(client, `select count(*) from public.companies`)) === 0);
    await resetRole(client);

    await asRole(client, 'authenticated', AUTH_SALES);
    check('Active sales user sees CRM leads', Number(await scalar(client, `select count(*) from public.leads`)) >= 1);
    check('Sales user sees only own users row', Number(await scalar(client, `select count(*) from public.users`)) === 1);
    check('Sales user blocked from audit logs', Number(await scalar(client, `select count(*) from public.audit_logs`)) === 0);
    // Pre-seed, the only knowledge doc is the pending fixture -> hidden from sales
    check('Sales user sees no knowledge docs pre-seed (pending hidden)', Number(await scalar(client, `select count(*) from public.knowledge_documents`)) === 0);
    const salesKnowledge = Number(await scalar(client, `select count(*) from public.knowledge_documents where approval_status = 'pending'`));
    check('Sales user cannot see pending knowledge docs', salesKnowledge === 0);
    await expectError(
      'Authenticated INSERT into leads is denied (writes go through server layer)',
      () => q(client, `insert into public.leads (company) values ('rls probe')`),
      '42501',
    );
    await resetRole(client);

    await asRole(client, 'authenticated', AUTH_ADMIN);
    check('Admin sees audit logs', Number(await scalar(client, `select count(*) from public.audit_logs`)) >= 1);
    check('Admin sees all users rows', Number(await scalar(client, `select count(*) from public.users`)) >= 2);
    check('Admin sees pending knowledge docs', Number(await scalar(client, `select count(*) from public.knowledge_documents where approval_status = 'pending'`)) >= 1);
    await resetRole(client);

    await asRole(client, 'anon', null);
    await expectError('anon role has no table access', () => q(client, `select * from public.leads`), '42501');
    await resetRole(client);

    await asRole(client, 'service_role', null);
    check('service_role bypasses RLS (audit logs)', Number(await scalar(client, `select count(*) from public.audit_logs`)) >= 1);
    await resetRole(client);

    // ------------------------------------------------------------------
    // 6. Constraints, triggers, integrity
    // ------------------------------------------------------------------
    await expectError(
      'CHECK: invalid lead status rejected',
      () => q(client, `insert into public.leads (company, status) values ('c', 'bogus')`),
      '23514',
    );
    await expectError(
      'CHECK: lead_score above 100 rejected',
      () => q(client, `insert into public.leads (company, lead_score) values ('c', 150)`),
      '23514',
    );
    await expectError(
      'CHECK: invalid approval action_type rejected',
      () => q(client, `insert into public.approvals (action_type) values ('send_money')`),
      '23514',
    );
    await expectError(
      'FK RESTRICT: company with customer cannot be deleted',
      () => q(client, `delete from public.companies where id = '${FIX_COMPANY}'`),
      '23503',
    );

    const before = await scalar(client, `select updated_at from public.leads where id = '${FIX_LEAD}'`);
    await new Promise((r) => setTimeout(r, 50));
    await q(client, `update public.leads set notes = 'trigger probe' where id = '${FIX_LEAD}'`);
    const after = await scalar(client, `select updated_at from public.leads where id = '${FIX_LEAD}'`);
    check('updated_at trigger fires on UPDATE', new Date(after) > new Date(before));

    // ------------------------------------------------------------------
    // 7. Seed data (applied like `supabase db reset` would)
    // ------------------------------------------------------------------
    try {
      await q(client, fs.readFileSync(SEED_FILE, 'utf8'));
      await q(client, fs.readFileSync(SEED_FILE, 'utf8')); // twice: proves idempotence
      check('seed.sql applies cleanly and is idempotent', true);
    } catch (e) {
      check('seed.sql applies cleanly and is idempotent', false, `${e.code ?? ''} ${e.message}`);
    }
    const seedCounts = await one(client, `
      select
        (select count(*) from public.roles where name in ('owner','admin','sales','marketing','operations','viewer'))          as roles,
        (select count(*) from public.permissions)                                                                              as permissions,
        (select count(*) from public.users where name like '[DEMO]%' and status = 'inactive' and auth_user_id is null)         as demo_users,
        (select count(*) from public.leads where company like '[DEMO]%')                                                       as demo_leads,
        (select count(*) from public.app_settings)                                                                             as settings
    `);
    check(
      'Seed: 6 roles, 11 permissions, 6 inactive demo users, demo leads, 4 settings',
      Number(seedCounts.roles) === 6 && Number(seedCounts.permissions) === 11 && Number(seedCounts.demo_users) === 6 && Number(seedCounts.demo_leads) >= 1 && Number(seedCounts.settings) === 4,
      JSON.stringify(seedCounts),
    );

    const searchHits = Number(await scalar(client, `select count(*) from public.knowledge_chunks where search @@ to_tsquery('english', 'medical')`));
    check('knowledge_chunks full-text search works', searchHits >= 1, `${searchHits} hits`);

    // Post-seed: sales sees the approved demo doc but still not pending docs
    await asRole(client, 'authenticated', AUTH_SALES);
    const salesPostSeed = await one(client, `
      select
        count(*) filter (where approval_status = 'approved') as approved_visible,
        count(*) filter (where approval_status = 'pending')  as pending_visible
      from public.knowledge_documents
    `);
    check(
      'Sales user: approved knowledge visible, pending hidden (post-seed)',
      Number(salesPostSeed.approved_visible) >= 1 && Number(salesPostSeed.pending_visible) === 0,
      JSON.stringify(salesPostSeed),
    );
    await resetRole(client);

    // Seed demo users must never be sign-in-able
    const demoActive = Number(await scalar(client, `select count(*) from public.users where name like '[DEMO]%' and (status <> 'inactive' or auth_user_id is not null)`));
    check('Demo users are inactive and unlinked from auth', demoActive === 0);

    // ------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------
    const failed = results.filter((r) => !r.ok);
    console.log(`\n===== ${results.length - failed.length}/${results.length} checks passed =====`);
    if (failed.length > 0) {
      console.log('FAILED CHECKS:');
      for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
      process.exitCode = 1;
    }
  } finally {
    await client.end().catch(() => {});
    await pg.stop().catch(() => {});
    if (process.exitCode !== 1) {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
    } else {
      console.log(`(test database kept for inspection at ${DATA_DIR})`);
    }
  }
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exit(1);
});
