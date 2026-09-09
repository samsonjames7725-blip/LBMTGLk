import type {
  AgentRun,
  Approval,
  AppUser,
  AuditLog,
  AutomationRun,
  Company,
  Contact,
  Customer,
  Email,
  Interaction,
  KnowledgeChunk,
  KnowledgeDocument,
  Opportunity,
  Proposal,
  Task,
} from '@/types/database';
import type {
  AgentRunRepository,
  ApprovalRepository,
  AuditEntry,
  AuditRepository,
  AutomationRunRepository,
  CompanyRepository,
  ContactRepository,
  CustomerRepository,
  EmailRepository,
  FollowupRepository,
  InteractionRepository,
  KnowledgeRepository,
  LeadRepository,
  OpportunityRepository,
  ProposalRepository,
  TaskRepository,
  UserRepository,
} from '../types';
import { dbError, supabaseTable } from './generic';
import { SupabaseLeadRepository } from './leads';
import { SupabaseFollowupRepository } from './followups';
import { getAdminClient } from '@/supabase/server';

// --- Simple CRUD repositories ------------------------------------------------

const companyCrud = supabaseTable<Company>('companies');
export class SupabaseCompanyRepository implements CompanyRepository {
  getById = companyCrud.getById;
  create = companyCrud.create;
  update = companyCrud.update;

  async list(opts: { search?: string; limit?: number; offset?: number } = {}) {
    let query = getAdminClient().from('companies').select('*', { count: 'exact' });
    if (opts.search) query = query.ilike('name', `%${opts.search.replace(/[%,]/g, '')}%`);
    query = query.order('name').range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
    const { data, error, count } = await query;
    if (error) throw dbError('companies.list', error);
    return { items: (data ?? []) as Company[], total: count ?? 0 };
  }

  async findByName(name: string): Promise<Company | null> {
    const { data, error } = await getAdminClient()
      .from('companies')
      .select('*')
      .ilike('name', name)
      .limit(1)
      .maybeSingle<Company>();
    if (error) throw dbError('companies.findByName', error);
    return data ?? null;
  }
}

const contactCrud = supabaseTable<Contact>('contacts');
export class SupabaseContactRepository implements ContactRepository {
  getById = contactCrud.getById;
  create = contactCrud.create;

  async list(opts: { companyId?: string; limit?: number } = {}): Promise<Contact[]> {
    let query = getAdminClient().from('contacts').select('*').order('name').limit(opts.limit ?? 200);
    if (opts.companyId) query = query.eq('company_id', opts.companyId);
    const { data, error } = await query;
    if (error) throw dbError('contacts.list', error);
    return (data ?? []) as Contact[];
  }
}

const customerCrud = supabaseTable<Customer>('customers');
export class SupabaseCustomerRepository implements CustomerRepository {
  getById = customerCrud.getById;
  create = customerCrud.create;
  update = customerCrud.update;

  async list(opts: { limit?: number } = {}): Promise<Customer[]> {
    const { data, error } = await getAdminClient()
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);
    if (error) throw dbError('customers.list', error);
    return (data ?? []) as Customer[];
  }
}

const opportunityCrud = supabaseTable<Opportunity>('opportunities');
export class SupabaseOpportunityRepository implements OpportunityRepository {
  getById = opportunityCrud.getById;
  create = opportunityCrud.create;
  update = opportunityCrud.update;

  async list(opts: { stage?: Opportunity['stage']; limit?: number } = {}): Promise<Opportunity[]> {
    let query = getAdminClient()
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);
    if (opts.stage) query = query.eq('stage', opts.stage);
    const { data, error } = await query;
    if (error) throw dbError('opportunities.list', error);
    return (data ?? []) as Opportunity[];
  }
}

const interactionCrud = supabaseTable<Interaction>('interactions');
export class SupabaseInteractionRepository implements InteractionRepository {
  create = interactionCrud.create;

  async listByLead(leadId: string, limit = 50): Promise<Interaction[]> {
    const { data, error } = await getAdminClient()
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw dbError('interactions.listByLead', error);
    return (data ?? []) as Interaction[];
  }

  async listByCompany(companyId: string, limit = 50): Promise<Interaction[]> {
    const { data, error } = await getAdminClient()
      .from('interactions')
      .select('*')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw dbError('interactions.listByCompany', error);
    return (data ?? []) as Interaction[];
  }

  async listRecent(limit = 20): Promise<Interaction[]> {
    const { data, error } = await getAdminClient()
      .from('interactions')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw dbError('interactions.listRecent', error);
    return (data ?? []) as Interaction[];
  }
}

const taskCrud = supabaseTable<Task>('tasks');
export class SupabaseTaskRepository implements TaskRepository {
  getById = taskCrud.getById;
  create = taskCrud.create;
  update = taskCrud.update;

  async list(
    opts: { status?: Task['status']; assignedTo?: string; dueBefore?: string; leadId?: string; limit?: number } = {},
  ): Promise<Task[]> {
    let query = getAdminClient()
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(opts.limit ?? 100);
    if (opts.status) query = query.eq('status', opts.status);
    if (opts.assignedTo) query = query.eq('assigned_to', opts.assignedTo);
    if (opts.dueBefore) query = query.lt('due_date', opts.dueBefore);
    if (opts.leadId) query = query.eq('lead_id', opts.leadId);
    const { data, error } = await query;
    if (error) throw dbError('tasks.list', error);
    return (data ?? []) as Task[];
  }
}

const approvalCrud = supabaseTable<Approval>('approvals');
export class SupabaseApprovalRepository implements ApprovalRepository {
  getById = approvalCrud.getById;
  create = approvalCrud.create;
  update = approvalCrud.update;

  async list(opts: { status?: Approval['status']; limit?: number } = {}): Promise<Approval[]> {
    let query = getAdminClient()
      .from('approvals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error } = await query;
    if (error) throw dbError('approvals.list', error);
    return (data ?? []) as Approval[];
  }
}

const emailCrud = supabaseTable<Email>('emails');
export class SupabaseEmailRepository implements EmailRepository {
  getById = emailCrud.getById;
  create = emailCrud.create;
  update = emailCrud.update;

  async list(opts: { status?: Email['status']; limit?: number } = {}): Promise<Email[]> {
    let query = getAdminClient()
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error } = await query;
    if (error) throw dbError('emails.list', error);
    return (data ?? []) as Email[];
  }
}

const proposalCrud = supabaseTable<Proposal>('proposals');
export class SupabaseProposalRepository implements ProposalRepository {
  getById = proposalCrud.getById;
  create = proposalCrud.create;
  update = proposalCrud.update;

  async list(opts: { limit?: number } = {}): Promise<Proposal[]> {
    const { data, error } = await getAdminClient()
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);
    if (error) throw dbError('proposals.list', error);
    return (data ?? []) as Proposal[];
  }
}

// --- Knowledge ----------------------------------------------------------------

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  async listDocuments(status?: KnowledgeDocument['approval_status'], limit = 100): Promise<KnowledgeDocument[]> {
    let query = getAdminClient()
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('approval_status', status);
    const { data, error } = await query;
    if (error) throw dbError('knowledge_documents.list', error);
    return (data ?? []) as KnowledgeDocument[];
  }

  getDocument = supabaseTable<KnowledgeDocument>('knowledge_documents').getById;

  createDocument = supabaseTable<KnowledgeDocument>('knowledge_documents').create;

  async setDocumentStatus(id: string, status: KnowledgeDocument['approval_status']): Promise<KnowledgeDocument> {
    return supabaseTable<KnowledgeDocument>('knowledge_documents').update(id, { approval_status: status });
  }

  async createChunks(documentId: string, chunks: { index: number; content: string }[]): Promise<KnowledgeChunk[]> {
    const rows = chunks.map((c) => ({ document_id: documentId, chunk_index: c.index, content: c.content }));
    const { data, error } = await getAdminClient().from('knowledge_chunks').insert(rows).select('*');
    if (error) throw dbError('knowledge_chunks.create', error);
    return (data ?? []) as KnowledgeChunk[];
  }

  async searchChunks(query: string, limit = 5): Promise<KnowledgeChunk[]> {
    const { data, error } = await getAdminClient()
      .from('knowledge_chunks')
      .select('*')
      .textSearch('search', query, { type: 'websearch' })
      .limit(limit);
    if (error) throw dbError('knowledge_chunks.search', error);
    return (data ?? []) as KnowledgeChunk[];
  }
}

// --- Governance / observability -------------------------------------------------

export class SupabaseAuditRepository implements AuditRepository {
  async record(entry: AuditEntry): Promise<void> {
    const { error } = await getAdminClient().from('audit_logs').insert({
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entity_id ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) throw dbError('audit_logs.record', error);
  }

  async listRecent(limit = 50, action?: string): Promise<AuditLog[]> {
    let query = getAdminClient()
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (action) query = query.eq('action', action);
    const { data, error } = await query;
    if (error) throw dbError('audit_logs.list', error);
    return (data ?? []) as AuditLog[];
  }
}

export class SupabaseAgentRunRepository implements AgentRunRepository {
  async start(input: {
    agentName: string;
    taskType: AgentRun['task_type'];
    userId: string | null;
    input: Record<string, unknown>;
    approvalRequired: boolean;
  }): Promise<AgentRun> {
    const { data, error } = await getAdminClient()
      .from('agent_runs')
      .insert({
        agent_name: input.agentName,
        task_type: input.taskType,
        user_id: input.userId,
        input: input.input,
        approval_required: input.approvalRequired,
        status: 'running',
      })
      .select('*')
      .single<AgentRun>();
    if (error) throw dbError('agent_runs.start', error);
    return data;
  }

  async complete(id: string, output: Record<string, unknown>, approvalId?: string | null): Promise<void> {
    const { error } = await getAdminClient()
      .from('agent_runs')
      .update({ status: 'completed', output, approval_id: approvalId ?? null, completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw dbError('agent_runs.complete', error);
  }

  async fail(id: string, errorCode: string): Promise<void> {
    const { error } = await getAdminClient()
      .from('agent_runs')
      .update({ status: 'failed', error_code: errorCode, completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw dbError('agent_runs.fail', error);
  }

  async listRecent(limit = 20): Promise<AgentRun[]> {
    const { data, error } = await getAdminClient()
      .from('agent_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw dbError('agent_runs.list', error);
    return (data ?? []) as AgentRun[];
  }
}

export class SupabaseAutomationRunRepository implements AutomationRunRepository {
  async start(name: string): Promise<AutomationRun> {
    const { data, error } = await getAdminClient()
      .from('automation_runs')
      .insert({ automation: name, status: 'running' })
      .select('*')
      .single<AutomationRun>();
    if (error) throw dbError('automation_runs.start', error);
    return data;
  }

  async complete(id: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await getAdminClient()
      .from('automation_runs')
      .update({ status: 'success', result, completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw dbError('automation_runs.complete', error);
  }

  async fail(id: string, error: string): Promise<void> {
    const { error: dbErr } = await getAdminClient()
      .from('automation_runs')
      .update({ status: 'failed', error, completed_at: new Date().toISOString() })
      .eq('id', id);
    if (dbErr) throw dbError('automation_runs.fail', dbErr);
  }

  async listRecent(limit = 20): Promise<AutomationRun[]> {
    const { data, error } = await getAdminClient()
      .from('automation_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw dbError('automation_runs.list', error);
    return (data ?? []) as AutomationRun[];
  }
}

export class SupabaseUserRepository implements UserRepository {
  async getById(id: string): Promise<AppUser | null> {
    const { data, error } = await getAdminClient().from('users').select('*').eq('id', id).maybeSingle<AppUser>();
    if (error) throw dbError('users.getById', error);
    return data ?? null;
  }

  async list(limit = 200): Promise<AppUser[]> {
    const { data, error } = await getAdminClient().from('users').select('*').order('name').limit(limit);
    if (error) throw dbError('users.list', error);
    return (data ?? []) as AppUser[];
  }
}

// --- Singletons (services import these; tests inject fakes instead) ------------

export const leadRepository: LeadRepository = new SupabaseLeadRepository();
export const companyRepository: CompanyRepository = new SupabaseCompanyRepository();
export const contactRepository: ContactRepository = new SupabaseContactRepository();
export const customerRepository: CustomerRepository = new SupabaseCustomerRepository();
export const opportunityRepository: OpportunityRepository = new SupabaseOpportunityRepository();
export const interactionRepository: InteractionRepository = new SupabaseInteractionRepository();
export const taskRepository: TaskRepository = new SupabaseTaskRepository();
export const followupRepository: FollowupRepository = new SupabaseFollowupRepository();
export const approvalRepository: ApprovalRepository = new SupabaseApprovalRepository();
export const emailRepository: EmailRepository = new SupabaseEmailRepository();
export const proposalRepository: ProposalRepository = new SupabaseProposalRepository();
export const knowledgeRepository: KnowledgeRepository = new SupabaseKnowledgeRepository();
export const auditRepository: AuditRepository = new SupabaseAuditRepository();
export const agentRunRepository: AgentRunRepository = new SupabaseAgentRunRepository();
export const automationRunRepository: AutomationRunRepository = new SupabaseAutomationRunRepository();
export const userRepository: UserRepository = new SupabaseUserRepository();
