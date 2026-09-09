# ==============================================================================
# LifeBridge MedTech AI Business OS — consolidated database schema (REFERENCE)
# ==============================================================================
# This file is auto-generated from supabase/migrations/*.sql for review
# purposes. The migration files are the source of truth — do not edit this
# file directly. Regenerate with:  cat supabase/migrations/*.sql > supabase/schema.sql
#
# Seed data (dev/demo only) lives in supabase/seed.sql and is applied by
# `supabase db reset` locally; it is never pushed to the linked project.

-- ============================================================================
-- LifeBridge MedTech AI Business OS — initial schema
-- ============================================================================
-- Non-destructive migration: creates tables, indexes, constraints, RLS
-- policies, and storage buckets. It never drops or alters existing objects.
--
-- Design notes:
--   * All primary keys are UUIDs (gen_random_uuid(), core PostgreSQL 13+).
--   * All user-facing enum-ish values are enforced with CHECK constraints
--     (easier to extend later than native enum types).
--   * RLS is enabled on every table in `public` (deny-by-default). The
--     application performs all writes server-side with the secret key
--     (service role, bypasses RLS); `authenticated` clients get read-only
--     grants filtered by policies below.
--   * Helper functions live in the `private` schema, which is NOT exposed
--     through the Data API and is not granted to anon/authenticated roles.
--   * Cascading deletes are limited to derived/child data (activity logs,
--     knowledge chunks, join tables). Core business records use
--     RESTRICT/SET NULL so history is never silently destroyed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Private helper schema (not exposed via Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from anon, authenticated, public;

-- Touches updated_at on every UPDATE of tables that have the column.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

-- (current_app_user_id / has_role helper functions are created further down,
-- after the tables they reference exist.)

-- ---------------------------------------------------------------------------
-- Users, roles, permissions (RBAC)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_auth_user_id on public.users (auth_user_id);
create index idx_users_email on public.users (email);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);
create index idx_user_roles_user on public.user_roles (user_id);
create index idx_user_roles_role on public.user_roles (role_id);

-- ---------------------------------------------------------------------------
-- CRM: companies, contacts, leads, customers, opportunities, interactions
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  location text,
  description text,
  status text not null default 'prospect'
    check (status in ('prospect', 'active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_companies_name on public.companies (name);
create index idx_companies_status on public.companies (status);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  name text not null,
  designation text,
  email text,
  phone text,
  linkedin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contacts_company on public.contacts (company_id);
create index idx_contacts_email on public.contacts (email);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  -- Set when the lead is linked to a managed CRM company record.
  company_id uuid references public.companies (id) on delete set null,
  contact_name text,
  email text,
  phone text,
  website text,
  location text,
  industry text,
  requirement text,
  source text not null default 'website',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost')),
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  lead_temperature text not null default 'cold'
    check (lead_temperature in ('hot', 'warm', 'cold')),
  assigned_agent text,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leads_status on public.leads (status);
create index idx_leads_temperature on public.leads (lead_temperature);
create index idx_leads_score on public.leads (lead_score desc);
create index idx_leads_next_followup on public.leads (next_followup_at);
create index idx_leads_created_at on public.leads (created_at);
create index idx_leads_company_id on public.leads (company_id);
create index idx_leads_email on public.leads (email);
create index idx_leads_source on public.leads (source);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  primary_contact_id uuid references public.contacts (id) on delete set null,
  customer_status text not null default 'active'
    check (customer_status in ('active', 'on_hold', 'churned', 'archived')),
  customer_since date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_company on public.customers (company_id);
create index idx_customers_status on public.customers (customer_status);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  description text,
  stage text not null default 'new'
    check (stage in (
      'new', 'qualified', 'contacted', 'requirement_confirmed',
      'proposal_required', 'proposal_sent', 'negotiation', 'won', 'lost'
    )),
  estimated_value numeric(14, 2) check (estimated_value >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  probability integer check (probability between 0 and 100),
  expected_close_date date,
  owner_id uuid references public.users (id) on delete set null,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_opportunities_stage on public.opportunities (stage);
create index idx_opportunities_owner on public.opportunities (owner_id);
create index idx_opportunities_close_date on public.opportunities (expected_close_date);
create index idx_opportunities_company on public.opportunities (company_id);
create index idx_opportunities_lead on public.opportunities (lead_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  type text not null
    check (type in ('phone_call', 'meeting', 'email', 'whatsapp_note', 'website_enquiry', 'internal_note')),
  direction text check (direction in ('inbound', 'outbound', 'internal')),
  subject text,
  content text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_interactions_company on public.interactions (company_id);
create index idx_interactions_contact on public.interactions (contact_id);
create index idx_interactions_lead on public.interactions (lead_id);
create index idx_interactions_customer on public.interactions (customer_id);
create index idx_interactions_opportunity on public.interactions (opportunity_id);
create index idx_interactions_occurred on public.interactions (occurred_at desc);

-- ---------------------------------------------------------------------------
-- Tasks and follow-ups
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references public.users (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_status on public.tasks (status);
create index idx_tasks_due_date on public.tasks (due_date);
create index idx_tasks_assigned_to on public.tasks (assigned_to);
create index idx_tasks_lead on public.tasks (lead_id);
create index idx_tasks_customer on public.tasks (customer_id);
create index idx_tasks_opportunity on public.tasks (opportunity_id);

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  assigned_to uuid references public.users (id) on delete set null,
  followup_type text not null default 'call'
    check (followup_type in ('call', 'email', 'whatsapp', 'meeting', 'other')),
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled', 'overdue')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  draft_content text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_followups_status on public.followups (status);
create index idx_followups_scheduled_at on public.followups (scheduled_at);
create index idx_followups_lead on public.followups (lead_id);
create index idx_followups_customer on public.followups (customer_id);
create index idx_followups_opportunity on public.followups (opportunity_id);
create index idx_followups_assigned_to on public.followups (assigned_to);

-- ---------------------------------------------------------------------------
-- Approvals (human-in-the-loop gate for protected actions)
-- ---------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null
    check (action_type in (
      'outbound_sales_email', 'whatsapp_message', 'quotation', 'proposal',
      'website_publish', 'pricing_change', 'customer_commitment'
    )),
  entity_type text,
  entity_id uuid,
  requested_by uuid references public.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed')),
  payload jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_approvals_status on public.approvals (status);
create index idx_approvals_entity on public.approvals (entity_type, entity_id);
create index idx_approvals_requested_by on public.approvals (requested_by);
create index idx_approvals_created_at on public.approvals (created_at desc);

-- ---------------------------------------------------------------------------
-- Emails (draft-only until an approval is executed) and proposals
-- ---------------------------------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_address text,
  to_address text,
  subject text,
  body text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'sent', 'received', 'failed')),
  approval_id uuid references public.approvals (id) on delete set null,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_emails_status on public.emails (status);
create index idx_emails_lead on public.emails (lead_id);
create index idx_emails_customer on public.emails (customer_id);
create index idx_emails_opportunity on public.emails (opportunity_id);
create index idx_emails_approval on public.emails (approval_id);
create index idx_emails_created_at on public.emails (created_at desc);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected')),
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  document_path text,
  approval_id uuid references public.approvals (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_proposals_status on public.proposals (status);
create index idx_proposals_opportunity on public.proposals (opportunity_id);
create index idx_proposals_approval on public.proposals (approval_id);

-- ---------------------------------------------------------------------------
-- AI agent runs, audit logs, automations
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  task_type text not null default 'unknown'
    check (task_type in ('lead', 'sales', 'followup', 'email', 'proposal', 'analytics', 'report', 'customer_success', 'unknown')),
  user_id uuid references public.users (id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  approval_required boolean not null default false,
  approval_id uuid references public.approvals (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index idx_agent_runs_agent_name on public.agent_runs (agent_name);
create index idx_agent_runs_task_type on public.agent_runs (task_type);
create index idx_agent_runs_status on public.agent_runs (status);
create index idx_agent_runs_user on public.agent_runs (user_id);
create index idx_agent_runs_created_at on public.agent_runs (created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.users (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor);
create index idx_audit_logs_action on public.audit_logs (action);
create index idx_audit_logs_entity on public.audit_logs (entity, entity_id);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'skipped')),
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index idx_automation_runs_name on public.automation_runs (automation);
create index idx_automation_runs_status on public.automation_runs (status);
create index idx_automation_runs_created_at on public.automation_runs (created_at desc);

-- ---------------------------------------------------------------------------
-- Company knowledge (only approved documents feed production AI)
-- ---------------------------------------------------------------------------
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  category text not null
    check (category in (
      'company_profile', 'products', 'product_specifications', 'services',
      'certifications', 'warranty', 'previous_proposals', 'sops', 'faqs'
    )),
  description text,
  storage_path text not null,
  uploaded_by uuid references public.users (id) on delete set null,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_knowledge_documents_category on public.knowledge_documents (category);
create index idx_knowledge_documents_approval on public.knowledge_documents (approval_status);
create index idx_knowledge_documents_uploaded_by on public.knowledge_documents (uploaded_by);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  search tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);
create index idx_knowledge_chunks_document on public.knowledge_chunks (document_id);
create index idx_knowledge_chunks_search on public.knowledge_chunks using gin (search);

-- ---------------------------------------------------------------------------
-- Application settings (never store secret values here)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS helper functions (created here so their table references validate)
-- ---------------------------------------------------------------------------
-- Resolves the signed-in Supabase Auth user to the internal app user, and the
-- role checks used by policies. SECURITY DEFINER is required so policies can
-- reference them without recursing into the `users` table's own RLS. They
-- contain an auth.uid() check in their bodies and live in the non-exposed
-- `private` schema (never granted on the Data API).
create or replace function private.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
$$;

create or replace function private.has_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = private.current_app_user_id()
      and r.name = any (role_names)
  )
$$;

revoke all on function private.current_app_user_id() from public, anon, authenticated;
revoke all on function private.has_role(text[]) from public, anon, authenticated;
grant execute on function private.current_app_user_id() to authenticated, service_role;
grant execute on function private.has_role(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function private.set_updated_at();
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function private.set_updated_at();
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();
create trigger trg_opportunities_updated_at
  before update on public.opportunities
  for each row execute function private.set_updated_at();
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger trg_followups_updated_at
  before update on public.followups
  for each row execute function private.set_updated_at();
create trigger trg_approvals_updated_at
  before update on public.approvals
  for each row execute function private.set_updated_at();
create trigger trg_proposals_updated_at
  before update on public.proposals
  for each row execute function private.set_updated_at();
create trigger trg_knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled everywhere, deny-by-default
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;
alter table public.opportunities enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.followups enable row level security;
alter table public.approvals enable row level security;
alter table public.emails enable row level security;
alter table public.proposals enable row level security;
alter table public.agent_runs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.automation_runs enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.app_settings enable row level security;

-- Access model (defense in depth; the app authorizes writes server-side):
--   anon           -> no table grants at all
--   authenticated  -> SELECT only, filtered by the policies below
--   service_role   -> full access, bypasses RLS (server-side app layer)

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant usage on schema public to anon, authenticated;

grant select on
  public.users, public.roles, public.permissions, public.user_roles,
  public.companies, public.contacts, public.leads, public.customers,
  public.opportunities, public.interactions, public.tasks, public.followups,
  public.approvals, public.emails, public.proposals,
  public.agent_runs, public.audit_logs, public.automation_runs,
  public.knowledge_documents, public.knowledge_chunks, public.app_settings
to authenticated;

-- users: own profile always; owner/admin can see the full user list
create policy "users_select_own"
  on public.users for select
  to authenticated
  using (id = private.current_app_user_id());

create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (private.has_role (array['owner', 'admin']));

-- roles / permissions: readable by any active app user
create policy "roles_select_active_users"
  on public.roles for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "permissions_select_active_users"
  on public.permissions for select
  to authenticated
  using (private.current_app_user_id() is not null);

-- user_roles: own assignments; owner/admin can see all
create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using (user_id = private.current_app_user_id());

create policy "user_roles_select_admin"
  on public.user_roles for select
  to authenticated
  using (private.has_role (array['owner', 'admin']));

-- Shared company CRM data: readable by every active app user.
-- (Writes go through the server-side authorization layer, not direct API.)
create policy "companies_select_active_users"
  on public.companies for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "contacts_select_active_users"
  on public.contacts for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "leads_select_active_users"
  on public.leads for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "customers_select_active_users"
  on public.customers for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "opportunities_select_active_users"
  on public.opportunities for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "interactions_select_active_users"
  on public.interactions for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "tasks_select_active_users"
  on public.tasks for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "followups_select_active_users"
  on public.followups for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "approvals_select_active_users"
  on public.approvals for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "emails_select_active_users"
  on public.emails for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "proposals_select_active_users"
  on public.proposals for select
  to authenticated
  using (private.current_app_user_id() is not null);

create policy "agent_runs_select_active_users"
  on public.agent_runs for select
  to authenticated
  using (private.current_app_user_id() is not null);

-- audit logs: owner/admin only
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (private.has_role (array['owner', 'admin']));

create policy "automation_runs_select_active_users"
  on public.automation_runs for select
  to authenticated
  using (private.current_app_user_id() is not null);

-- knowledge: approved documents for active users; uploaders and admins
-- also see their pending/rejected documents
create policy "knowledge_documents_select"
  on public.knowledge_documents for select
  to authenticated
  using (
    approval_status = 'approved'
    or uploaded_by = private.current_app_user_id()
    or private.has_role (array['owner', 'admin'])
  );

create policy "knowledge_chunks_select"
  on public.knowledge_chunks for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_documents d
      where d.id = knowledge_chunks.document_id
        and (
          d.approval_status = 'approved'
          or d.uploaded_by = private.current_app_user_id()
          or private.has_role (array['owner', 'admin'])
        )
    )
  );

create policy "app_settings_select_active_users"
  on public.app_settings for select
  to authenticated
  using (private.current_app_user_id() is not null);

-- ---------------------------------------------------------------------------
-- Storage: private buckets for knowledge, proposals and internal files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('company-knowledge', 'company-knowledge', false, 52428800),
  ('proposals', 'proposals', false, 52428800),
  ('internal-files', 'internal-files', false, 52428800)
on conflict (id) do nothing;

-- Upsert needs INSERT + SELECT + UPDATE privileges (see Supabase storage docs).
create policy "storage_select_active_users"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('company-knowledge', 'proposals', 'internal-files')
    and private.current_app_user_id() is not null
  );

create policy "storage_insert_active_users"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('company-knowledge', 'proposals', 'internal-files')
    and private.current_app_user_id() is not null
  );

create policy "storage_update_active_users"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('company-knowledge', 'proposals', 'internal-files')
    and private.current_app_user_id() is not null
  )
  with check (
    bucket_id in ('company-knowledge', 'proposals', 'internal-files')
    and private.current_app_user_id() is not null
  );
