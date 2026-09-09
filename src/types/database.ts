// Database row types mirroring supabase/migrations (hand-maintained until a
// codegen step is added). Keep in sync with the migration files.

export type UUID = string;

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';
export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type CompanyStatus = 'prospect' | 'active' | 'inactive' | 'archived';
export type CustomerStatus = 'active' | 'on_hold' | 'churned' | 'archived';
export type OpportunityStage =
  | 'new'
  | 'qualified'
  | 'contacted'
  | 'requirement_confirmed'
  | 'proposal_required'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type FollowupStatus = 'pending' | 'completed' | 'cancelled' | 'overdue';
export type FollowupType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'other';
export type InteractionType =
  | 'phone_call'
  | 'meeting'
  | 'email'
  | 'whatsapp_note'
  | 'website_enquiry'
  | 'internal_note';
export type EmailStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'received' | 'failed';
export type ProposalStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'rejected';
export type ApprovalActionType =
  | 'outbound_sales_email'
  | 'whatsapp_message'
  | 'quotation'
  | 'proposal'
  | 'website_publish'
  | 'pricing_change'
  | 'customer_commitment';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed';
export type AgentTaskType =
  | 'lead'
  | 'sales'
  | 'followup'
  | 'email'
  | 'proposal'
  | 'analytics'
  | 'report'
  | 'customer_success'
  | 'unknown';
export type KnowledgeCategory =
  | 'company_profile'
  | 'products'
  | 'product_specifications'
  | 'services'
  | 'certifications'
  | 'warranty'
  | 'previous_proposals'
  | 'sops'
  | 'faqs';
export type KnowledgeApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AppUser {
  id: UUID;
  auth_user_id: UUID | null;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: UUID;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Company {
  id: UUID;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: UUID;
  company_id: UUID | null;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: UUID;
  company: string;
  company_id: UUID | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  industry: string | null;
  requirement: string | null;
  source: string;
  status: LeadStatus;
  lead_score: number;
  lead_temperature: LeadTemperature;
  assigned_agent: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: UUID;
  company_id: UUID;
  primary_contact_id: UUID | null;
  customer_status: CustomerStatus;
  customer_since: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: UUID;
  company_id: UUID;
  lead_id: UUID | null;
  name: string;
  description: string | null;
  stage: OpportunityStage;
  estimated_value: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  owner_id: UUID | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: UUID;
  company_id: UUID | null;
  contact_id: UUID | null;
  lead_id: UUID | null;
  customer_id: UUID | null;
  opportunity_id: UUID | null;
  type: InteractionType;
  direction: 'inbound' | 'outbound' | 'internal' | null;
  subject: string | null;
  content: string | null;
  occurred_at: string;
  created_by: UUID | null;
  created_at: string;
}

export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  assigned_to: UUID | null;
  lead_id: UUID | null;
  customer_id: UUID | null;
  opportunity_id: UUID | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: UUID;
  lead_id: UUID | null;
  customer_id: UUID | null;
  opportunity_id: UUID | null;
  assigned_to: UUID | null;
  followup_type: FollowupType;
  scheduled_at: string;
  status: FollowupStatus;
  priority: Priority;
  draft_content: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: UUID;
  action_type: ApprovalActionType;
  entity_type: string | null;
  entity_id: UUID | null;
  requested_by: UUID | null;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  reviewed_by: UUID | null;
  reviewed_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: UUID;
  lead_id: UUID | null;
  customer_id: UUID | null;
  opportunity_id: UUID | null;
  direction: 'outbound' | 'inbound';
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  status: EmailStatus;
  approval_id: UUID | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface Proposal {
  id: UUID;
  opportunity_id: UUID | null;
  title: string;
  description: string | null;
  status: ProposalStatus;
  estimated_value: number | null;
  document_path: string | null;
  approval_id: UUID | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: UUID;
  agent_name: string;
  task_type: AgentTaskType;
  user_id: UUID | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  approval_required: boolean;
  approval_id: UUID | null;
  started_at: string;
  completed_at: string | null;
  error_code: string | null;
  created_at: string;
}

export interface AuditLog {
  id: UUID;
  actor: UUID | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutomationRun {
  id: UUID;
  automation: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failed' | 'skipped';
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface KnowledgeDocument {
  id: UUID;
  filename: string;
  category: KnowledgeCategory;
  description: string | null;
  storage_path: string;
  uploaded_by: UUID | null;
  approval_status: KnowledgeApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: UUID;
  document_id: UUID;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_by: UUID | null;
  updated_at: string;
}
