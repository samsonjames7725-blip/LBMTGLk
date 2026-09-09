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
  Followup,
  Interaction,
  KnowledgeChunk,
  KnowledgeDocument,
  Lead,
  Opportunity,
  Proposal,
  Task,
} from '@/types/database';

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface LeadFilters {
  search?: string;
  status?: Lead['status'];
  temperature?: Lead['lead_temperature'];
  source?: string;
  sort?: 'created_at' | 'lead_score' | 'company';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface LeadRepository {
  list(filters?: LeadFilters): Promise<ListResult<Lead>>;
  getById(id: string): Promise<Lead | null>;
  findByEmail(email: string): Promise<Lead | null>;
  create(dto: Partial<Lead>): Promise<Lead>;
  update(id: string, patch: Partial<Lead>): Promise<Lead>;
}

export interface CompanyRepository {
  list(opts?: { search?: string; limit?: number; offset?: number }): Promise<ListResult<Company>>;
  getById(id: string): Promise<Company | null>;
  findByName(name: string): Promise<Company | null>;
  create(dto: Partial<Company>): Promise<Company>;
  update(id: string, patch: Partial<Company>): Promise<Company>;
}

export interface ContactRepository {
  list(opts?: { companyId?: string; limit?: number }): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  create(dto: Partial<Contact>): Promise<Contact>;
}

export interface CustomerRepository {
  list(opts?: { limit?: number }): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  create(dto: Partial<Customer>): Promise<Customer>;
  update(id: string, patch: Partial<Customer>): Promise<Customer>;
}

export interface OpportunityRepository {
  list(opts?: { stage?: Opportunity['stage']; limit?: number }): Promise<Opportunity[]>;
  getById(id: string): Promise<Opportunity | null>;
  create(dto: Partial<Opportunity>): Promise<Opportunity>;
  update(id: string, patch: Partial<Opportunity>): Promise<Opportunity>;
}

export interface InteractionRepository {
  listByLead(leadId: string, limit?: number): Promise<Interaction[]>;
  listByCompany(companyId: string, limit?: number): Promise<Interaction[]>;
  listRecent(limit?: number): Promise<Interaction[]>;
  create(dto: Partial<Interaction>): Promise<Interaction>;
}

export interface TaskRepository {
  list(opts?: { status?: Task['status']; assignedTo?: string; dueBefore?: string; leadId?: string; limit?: number }): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  create(dto: Partial<Task>): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
}

export interface FollowupRepository {
  list(opts?: { status?: Followup['status']; scheduledFrom?: string; scheduledTo?: string; leadId?: string; limit?: number }): Promise<Followup[]>;
  getById(id: string): Promise<Followup | null>;
  create(dto: Partial<Followup>): Promise<Followup>;
  update(id: string, patch: Partial<Followup>): Promise<Followup>;
  /** Flags pending follow-ups whose scheduled time has passed. Returns count. */
  markOverdue(): Promise<number>;
}

export interface ApprovalRepository {
  list(opts?: { status?: Approval['status']; limit?: number }): Promise<Approval[]>;
  getById(id: string): Promise<Approval | null>;
  create(dto: Partial<Approval>): Promise<Approval>;
  update(id: string, patch: Partial<Approval>): Promise<Approval>;
}

export interface EmailRepository {
  list(opts?: { status?: Email['status']; limit?: number }): Promise<Email[]>;
  getById(id: string): Promise<Email | null>;
  create(dto: Partial<Email>): Promise<Email>;
  update(id: string, patch: Partial<Email>): Promise<Email>;
}

export interface ProposalRepository {
  list(opts?: { limit?: number }): Promise<Proposal[]>;
  getById(id: string): Promise<Proposal | null>;
  create(dto: Partial<Proposal>): Promise<Proposal>;
  update(id: string, patch: Partial<Proposal>): Promise<Proposal>;
}

export interface KnowledgeRepository {
  listDocuments(status?: KnowledgeDocument['approval_status'], limit?: number): Promise<KnowledgeDocument[]>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  createDocument(dto: Partial<KnowledgeDocument>): Promise<KnowledgeDocument>;
  setDocumentStatus(id: string, status: KnowledgeDocument['approval_status']): Promise<KnowledgeDocument>;
  createChunks(documentId: string, chunks: { index: number; content: string }[]): Promise<KnowledgeChunk[]>;
  searchChunks(query: string, limit?: number): Promise<KnowledgeChunk[]>;
}

export interface AuditEntry {
  actor: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
  listRecent(limit?: number, action?: string): Promise<AuditLog[]>;
}

export interface AgentRunRepository {
  start(input: { agentName: string; taskType: AgentRun['task_type']; userId: string | null; input: Record<string, unknown>; approvalRequired: boolean }): Promise<AgentRun>;
  complete(id: string, output: Record<string, unknown>, approvalId?: string | null): Promise<void>;
  fail(id: string, errorCode: string): Promise<void>;
  listRecent(limit?: number): Promise<AgentRun[]>;
}

export interface AutomationRunRepository {
  start(name: string): Promise<AutomationRun>;
  complete(id: string, result: Record<string, unknown>): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  listRecent(limit?: number): Promise<AutomationRun[]>;
}

export interface UserRepository {
  getById(id: string): Promise<AppUser | null>;
  list(limit?: number): Promise<AppUser[]>;
}
