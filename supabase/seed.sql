-- ============================================================================
-- LifeBridge MedTech — seed data (DEVELOPMENT / DEMO ONLY)
-- ============================================================================
-- Every demo row is prefixed with "[DEMO]" and uses reserved UUID ranges
-- (00000000-0000-4000-8000-0000000000xx). Nothing here represents a real
-- customer, contact, or business metric.
--
-- This file is applied by `supabase db reset` (local development only).
-- `supabase db push` does NOT run seed files against the linked/production
-- project, so demo data never reaches production through this file.
--
-- Demo users are created with status 'inactive' and no auth_user_id: they can
-- never sign in. Link a real Supabase Auth user to a row in public.users to
-- grant someone access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles (fixed UUIDs so user_roles mappings stay deterministic)
-- ---------------------------------------------------------------------------
insert into public.roles (id, name, description) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner',      'Full system access: settings, users, approvals, business data'),
  ('00000000-0000-4000-8000-0000000000a2', 'admin',      'CRM, users where permitted, approvals, analytics, settings'),
  ('00000000-0000-4000-8000-0000000000a3', 'sales',      'Leads, companies, contacts, customers, opportunities, tasks, follow-ups, email drafts'),
  ('00000000-0000-4000-8000-0000000000a4', 'marketing',  'Marketing data, leads, campaign architecture, analytics'),
  ('00000000-0000-4000-8000-0000000000a5', 'operations', 'Customers, tasks, proposals, operational workflows'),
  ('00000000-0000-4000-8000-0000000000a6', 'viewer',     'Read-only access')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Permissions (baseline; extend as capabilities are added)
-- ---------------------------------------------------------------------------
insert into public.permissions (id, name, description) values
  ('00000000-0000-4000-8000-0000000000b1', 'crm.read',           'Read CRM records (leads, companies, contacts, customers, opportunities)'),
  ('00000000-0000-4000-8000-0000000000b2', 'crm.write',          'Create and update CRM records'),
  ('00000000-0000-4000-8000-0000000000b3', 'leads.delete',       'Delete lead records where authorized'),
  ('00000000-0000-4000-8000-0000000000b4', 'approvals.review',   'Approve or reject pending approval requests'),
  ('00000000-0000-4000-8000-0000000000b5', 'approvals.request',  'Create approval requests for protected actions'),
  ('00000000-0000-4000-8000-0000000000b6', 'ai.run',             'Invoke AI agents through the AI Manager'),
  ('00000000-0000-4000-8000-0000000000b7', 'knowledge.manage',   'Upload, approve, and manage company knowledge documents'),
  ('00000000-0000-4000-8000-0000000000b8', 'users.manage',       'Manage users, roles, and permissions'),
  ('00000000-0000-4000-8000-0000000000b9', 'settings.manage',    'Manage application settings'),
  ('00000000-0000-4000-8000-0000000000ba', 'analytics.read',     'Read analytics and management reports'),
  ('00000000-0000-4000-8000-0000000000bb', 'audit.read',         'Read audit logs')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Application settings defaults (values only — secrets stay in env vars)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('email.mode',
   '"DRAFT_ONLY"',
   'External email sending is disabled. AI may create drafts only; sending requires an executed approval and is not implemented yet.'),
  ('ai.provider',
   '{"provider": "nvidia", "configured": false, "model": null}',
   'AI provider status. API keys are never stored here — they live in server-side environment variables.'),
  ('approvals.required_actions',
   '["outbound_sales_email", "whatsapp_message", "quotation", "proposal", "website_publish", "pricing_change", "customer_commitment"]',
   'Action types that always require human approval before execution.'),
  ('automation.enabled',
   '{"lead_qualification": true, "overdue_followups": true, "daily_report": false, "customer_reactivation": false, "pipeline_monitoring": false}',
   'Which internal automations are allowed to run (internal actions only: tasks, drafts, alerts).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- [DEMO] users (inactive; no linked auth account — cannot sign in)
-- ---------------------------------------------------------------------------
insert into public.users (id, name, email, status) values
  ('00000000-0000-4000-8000-0000000000d1', '[DEMO] Priya Owner',      'owner.demo@lifebridgemedtech.example',      'inactive'),
  ('00000000-0000-4000-8000-0000000000d2', '[DEMO] Arun Admin',       'admin.demo@lifebridgemedtech.example',      'inactive'),
  ('00000000-0000-4000-8000-0000000000d3', '[DEMO] Sneha Sales',      'sales.demo@lifebridgemedtech.example',      'inactive'),
  ('00000000-0000-4000-8000-0000000000d4', '[DEMO] Vikram Marketing', 'marketing.demo@lifebridgemedtech.example',  'inactive'),
  ('00000000-0000-4000-8000-0000000000d5', '[DEMO] Ravi Operations',  'operations.demo@lifebridgemedtech.example', 'inactive'),
  ('00000000-0000-4000-8000-0000000000d6', '[DEMO] Meera Viewer',     'viewer.demo@lifebridgemedtech.example',     'inactive')
on conflict (id) do nothing;

-- Map demo users to roles by name (robust even if roles already exist
-- with different ids). Demo users stay inactive and cannot sign in.
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from (values
  ('owner.demo@lifebridgemedtech.example',      'owner'),
  ('admin.demo@lifebridgemedtech.example',      'admin'),
  ('sales.demo@lifebridgemedtech.example',      'sales'),
  ('marketing.demo@lifebridgemedtech.example',  'marketing'),
  ('operations.demo@lifebridgemedtech.example', 'operations'),
  ('viewer.demo@lifebridgemedtech.example',     'viewer')
) as mapping (email, role_name)
join public.users u on u.email = mapping.email
join public.roles r on r.name = mapping.role_name
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- [DEMO] companies and contacts
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, website, industry, location, description, status) values
  ('00000000-0000-4000-8000-0000000000e1', '[DEMO] Sunrise Diagnostics',   'https://sunrisedx.example.com',  'Medical Diagnostics', 'Chennai, IN',  'Demo NABL-accredited diagnostic lab chain.', 'prospect'),
  ('00000000-0000-4000-8000-0000000000e2', '[DEMO] Apex Multi-Speciality', 'https://apexhosp.example.com',   'Healthcare',          'Coimbatore, IN', 'Demo multi-speciality hospital group.',    'active'),
  ('00000000-0000-4000-8000-0000000000e3', '[DEMO] VitalCare Clinics',    'https://vitalcare.example.com',  'Healthcare',          'Madurai, IN',   'Demo primary-care clinic network.',        'prospect')
on conflict (id) do nothing;

insert into public.contacts (id, company_id, name, designation, email, phone) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1', '[DEMO] Dr. Lakshmi Rao',  'Lab Director',       'lakshmi.rao@sunrisedx.example.com',  '+91-90000-00001'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000e2', '[DEMO] Mr. Karthik Iyer', 'Procurement Head',   'karthik.iyer@apexhosp.example.com',  '+91-90000-00002'),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000e3', '[DEMO] Ms. Divya Menon',  'Operations Manager', 'divya.menon@vitalcare.example.com',  '+91-90000-00003')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- [DEMO] leads
-- ---------------------------------------------------------------------------
insert into public.leads (id, company, company_id, contact_name, email, phone, website, location, industry, requirement, source, status, lead_score, lead_temperature, notes, next_followup_at) values
  ('00000000-0000-4000-8000-000000000101', '[DEMO] Sunrise Diagnostics', '00000000-0000-4000-8000-0000000000e1', 'Dr. Lakshmi Rao',
   'lakshmi.rao@sunrisedx.example.com', '+91-90000-00001', 'https://sunrisedx.example.com', 'Chennai, IN', 'Medical Diagnostics',
   '[DEMO] Needs 12-channel ECG machines and a maintenance plan for 4 lab sites.', 'website', 'qualified', 86, 'hot',
   'Demo lead with clear requirement, decision maker identified, high urgency.', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000102', '[DEMO] Apex Multi-Speciality', '00000000-0000-4000-8000-0000000000e2', 'Mr. Karthik Iyer',
   'karthik.iyer@apexhosp.example.com', '+91-90000-00002', 'https://apexhosp.example.com', 'Coimbatore, IN', 'Healthcare',
   '[DEMO] Evaluating patient monitoring systems for 30 beds.', 'referral', 'contacted', 64, 'warm',
   'Demo lead; budget approval expected next quarter.', now() + interval '3 day'),
  ('00000000-0000-4000-8000-000000000103', '[DEMO] VitalCare Clinics', '00000000-0000-4000-8000-0000000000e3', 'Ms. Divya Menon',
   'divya.menon@vitalcare.example.com', '+91-90000-00003', 'https://vitalcare.example.com', 'Madurai, IN', 'Healthcare',
   '[DEMO] Asked for a general product catalogue.', 'website', 'new', 38, 'cold',
   'Demo lead; requirement not yet specific.', now() + interval '5 day')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- [DEMO] opportunities, tasks, follow-ups, interactions
-- ---------------------------------------------------------------------------
insert into public.opportunities (id, company_id, lead_id, name, description, stage, estimated_value, currency, probability, owner_id, next_action) values
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000101',
   '[DEMO] Sunrise Dx — ECG fleet + AMC', 'Demo opportunity: 12-channel ECG machines and annual maintenance.',
   'requirement_confirmed', 1850000.00, 'INR', 60, '00000000-0000-4000-8000-0000000000d3',
   'Share proposal draft for internal review'),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000102',
   '[DEMO] Apex — patient monitoring rollout', 'Demo opportunity: 30-bed monitoring system.',
   'qualified', 4200000.00, 'INR', 35, '00000000-0000-4000-8000-0000000000d3',
   'Schedule site assessment')
on conflict (id) do nothing;

insert into public.tasks (id, title, description, priority, status, assigned_to, lead_id, due_date) values
  ('00000000-0000-4000-8000-000000000121', '[DEMO] Call Dr. Rao to confirm ECG quantities', 'Demo task: confirm fleet count and site access.', 'high', 'todo', '00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000101', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000122', '[DEMO] Prepare Apex monitoring demo checklist', 'Demo task: assemble demo unit checklist.', 'medium', 'in_progress', '00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000102', now() + interval '2 day')
on conflict (id) do nothing;

insert into public.followups (id, lead_id, assigned_to, followup_type, scheduled_at, status, priority, draft_content) values
  ('00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-0000000000d3', 'call', now() + interval '1 day', 'pending', 'high', null),
  ('00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-0000000000d3', 'email', now() - interval '2 day', 'pending', 'medium',
   '[AI Draft — DEMO] Follow-up email body placeholder for overdue demo follow-up.')
on conflict (id) do nothing;

insert into public.interactions (company_id, contact_id, lead_id, type, direction, subject, content, occurred_at, created_by) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000101',
   'website_enquiry', 'inbound', '[DEMO] Website enquiry — ECG machines', 'Demo enquiry submitted via website contact form.', now() - interval '3 day', null),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000000102',
   'phone_call', 'outbound', '[DEMO] Intro call with procurement head', 'Demo call summary: discussed monitoring requirements.', now() - interval '1 day', '00000000-0000-4000-8000-0000000000d3');

-- ---------------------------------------------------------------------------
-- [DEMO] approval + draft email (illustrates the human-in-the-loop flow)
-- ---------------------------------------------------------------------------
insert into public.approvals (id, action_type, entity_type, entity_id, requested_by, status, payload) values
  ('00000000-0000-4000-8000-000000000141', 'outbound_sales_email', 'lead', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-0000000000d3', 'pending',
   '{"subject": "[DEMO] Proposal follow-up — Sunrise Diagnostics", "to": "lakshmi.rao@sunrisedx.example.com", "body": "[AI Draft — DEMO] Draft email body pending human review."}'::jsonb)
on conflict (id) do nothing;

insert into public.emails (id, lead_id, direction, from_address, to_address, subject, body, status, approval_id) values
  ('00000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000101', 'outbound',
   'sales@lifebridgemedtech.example', 'lakshmi.rao@sunrisedx.example.com',
   '[DEMO] Proposal follow-up — Sunrise Diagnostics',
   '[AI Draft — DEMO] Draft email body pending human review.',
   'pending_approval', '00000000-0000-4000-8000-000000000141')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- [DEMO] AI activity + approved knowledge example
-- ---------------------------------------------------------------------------
insert into public.agent_runs (id, agent_name, task_type, user_id, input, output, status, approval_required, started_at, completed_at) values
  ('00000000-0000-4000-8000-000000000161', 'lead', 'lead', '00000000-0000-4000-8000-0000000000d3',
   '{"command": "[DEMO] Score new website leads"}'::jsonb,
   '{"summary": "[DEMO] Scored 3 demo leads; 1 hot, 1 warm, 1 cold."}'::jsonb,
   'completed', false, now() - interval '4 hour', now() - interval '4 hour' + interval '2 minute')
on conflict (id) do nothing;

insert into public.knowledge_documents (id, filename, category, description, storage_path, uploaded_by, approval_status) values
  ('00000000-0000-4000-8000-000000000171', '[DEMO] company-profile.md', 'company_profile', 'Demo company profile used to exercise the knowledge retrieval path.', 'company-knowledge/demo/company-profile.md', '00000000-0000-4000-8000-0000000000d2', 'approved')
on conflict (id) do nothing;

insert into public.knowledge_chunks (document_id, chunk_index, content) values
  ('00000000-0000-4000-8000-000000000171', 0, '[DEMO] LifeBridge MedTech supplies and services medical equipment for hospitals, laboratories, and clinics.')
on conflict do nothing;
