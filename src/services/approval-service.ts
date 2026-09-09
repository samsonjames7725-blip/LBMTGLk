import type { Approval, ApprovalActionType, ApprovalStatus } from '@/types/database';
import { approvalRepository, emailRepository, proposalRepository } from '@/repositories/supabase';
import { HttpError, NotFoundError } from '@/security/http';
import { recordAudit, AUDIT_ACTIONS } from './audit-service';
import type { SessionUser } from '@/auth/session';

/**
 * Pure approval state machine (spec §26). pending → approved | rejected;
 * approved → executed. Every other transition is illegal.
 */
export function transitionApproval(current: ApprovalStatus, action: 'approve' | 'reject' | 'execute'): ApprovalStatus {
  if (current === 'pending' && action === 'approve') return 'approved';
  if (current === 'pending' && action === 'reject') return 'rejected';
  if (current === 'approved' && action === 'execute') return 'executed';
  throw new HttpError(409, 'INVALID_STATE', `Cannot ${action} an approval in state "${current}"`);
}

/**
 * Actions whose execution performs an EXTERNAL communication. These stay
 * blocked until the email/WhatsApp delivery layer is actually implemented
 * (spec §55: DRAFT_ONLY; spec §99/§101: never fake an integration).
 */
const EXTERNAL_ACTIONS: ApprovalActionType[] = ['outbound_sales_email', 'whatsapp_message'];

export async function requestApproval(input: {
  action_type: ApprovalActionType;
  entity_type?: string | null;
  entity_id?: string | null;
  requested_by: string;
  payload?: Record<string, unknown>;
}): Promise<Approval> {
  const approval = await approvalRepository.create({
    action_type: input.action_type,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    requested_by: input.requested_by,
    status: 'pending',
    payload: input.payload ?? {},
  });
  await recordAudit({
    actor: input.requested_by,
    action: AUDIT_ACTIONS.approvalCreated,
    entity: 'approval',
    entity_id: approval.id,
    metadata: { action_type: input.action_type },
  });
  return approval;
}

export async function approve(id: string, reviewer: SessionUser): Promise<Approval> {
  const approval = await approvalRepository.getById(id);
  if (!approval) throw new NotFoundError('Approval not found');
  const status = transitionApproval(approval.status, 'approve');

  const updated = await approvalRepository.update(id, {
    status,
    reviewed_by: reviewer.appUser.id,
    reviewed_at: new Date().toISOString(),
  });

  // Internal side-effects of approval (record status only — no external sends).
  if (approval.entity_type === 'email' && approval.entity_id) {
    await emailRepository.update(approval.entity_id, { status: 'approved' });
    await recordAudit({ actor: reviewer.appUser.id, action: AUDIT_ACTIONS.emailApproved, entity: 'email', entity_id: approval.entity_id });
  }
  if (approval.entity_type === 'proposal' && approval.entity_id) {
    await proposalRepository.update(approval.entity_id, { status: 'approved' });
  }

  await recordAudit({
    actor: reviewer.appUser.id,
    action: AUDIT_ACTIONS.approvalApproved,
    entity: 'approval',
    entity_id: id,
    metadata: { action_type: approval.action_type },
  });
  return updated;
}

export async function reject(id: string, reviewer: SessionUser): Promise<Approval> {
  const approval = await approvalRepository.getById(id);
  if (!approval) throw new NotFoundError('Approval not found');
  const status = transitionApproval(approval.status, 'reject');

  const updated = await approvalRepository.update(id, {
    status,
    reviewed_by: reviewer.appUser.id,
    reviewed_at: new Date().toISOString(),
  });
  await recordAudit({
    actor: reviewer.appUser.id,
    action: AUDIT_ACTIONS.approvalRejected,
    entity: 'approval',
    entity_id: id,
    metadata: { action_type: approval.action_type },
  });
  return updated;
}

/**
 * Executes an approved action. Internal record updates only — external
 * communications (email/WhatsApp sending) are NOT implemented and raise an
 * honest error instead of pretending to send (spec RULE 11).
 */
export async function execute(id: string, actor: SessionUser): Promise<Approval> {
  const approval = await approvalRepository.getById(id);
  if (!approval) throw new NotFoundError('Approval not found');
  const status = transitionApproval(approval.status, 'execute');

  if (EXTERNAL_ACTIONS.includes(approval.action_type)) {
    throw new HttpError(
      501,
      'NOT_IMPLEMENTED',
      'External communication sending is disabled in DRAFT_ONLY mode. Deliver manually and record the outcome.',
    );
  }

  if (approval.entity_type === 'proposal' && approval.entity_id) {
    await proposalRepository.update(approval.entity_id, { status: 'sent' });
  }

  const updated = await approvalRepository.update(id, {
    status,
    executed_at: new Date().toISOString(),
  });
  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.approvalExecuted,
    entity: 'approval',
    entity_id: id,
    metadata: { action_type: approval.action_type },
  });
  return updated;
}

/** Creates a draft email + matching approval request in one flow. */
export async function requestEmailApproval(input: {
  emailId: string;
  leadId: string | null;
  requestedBy: string;
}): Promise<Approval> {
  const email = await emailRepository.getById(input.emailId);
  if (!email) throw new NotFoundError('Email draft not found');

  const approval = await requestApproval({
    action_type: 'outbound_sales_email',
    entity_type: 'email',
    entity_id: email.id,
    requested_by: input.requestedBy,
    payload: { subject: email.subject, to: email.to_address },
  });

  await emailRepository.update(email.id, { status: 'pending_approval', approval_id: approval.id });
  return approval;
}
