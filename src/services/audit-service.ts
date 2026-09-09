import type { AuditEntry } from '@/repositories/types';
import { auditRepository } from '@/repositories/supabase';

/** Audit actions tracked per spec §28. */
export const AUDIT_ACTIONS = {
  login: 'login',
  logout: 'logout',
  leadCreate: 'lead_create',
  leadUpdate: 'lead_update',
  customerUpdate: 'customer_update',
  opportunityCreate: 'opportunity_create',
  opportunityUpdate: 'opportunity_update',
  aiExecution: 'ai_execution',
  approvalCreated: 'approval_created',
  approvalApproved: 'approval_approved',
  approvalRejected: 'approval_rejected',
  approvalExecuted: 'approval_executed',
  emailDraft: 'email_draft',
  emailApproved: 'email_approved',
  emailExecuted: 'email_executed',
  settingsChanged: 'settings_changed',
  knowledgeUploaded: 'knowledge_uploaded',
  knowledgeApproved: 'knowledge_approved',
} as const;

/**
 * Writes an audit entry. Audit logging must never break the caller: failures
 * are logged server-side and swallowed.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await auditRepository.record(entry);
  } catch (error) {
    console.error('[audit] failed to record entry', {
      action: entry.action,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
