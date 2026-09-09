import type { NextRequest } from 'next/server';
import { proposalCreateSchema } from '@/validators/work';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { proposalRepository, opportunityRepository } from '@/repositories/supabase';
import { requestApproval } from '@/services/approval-service';
import { recordAudit, AUDIT_ACTIONS } from '@/services/audit-service';

export const dynamic = 'force-dynamic';

/** GET /api/proposals — list. */
export async function GET(_request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const proposals = await proposalRepository.list({ limit: 200 });
    return ok({ items: proposals, total: proposals.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/proposals — create a draft proposal and request the mandatory
 * approval (spec §24/§26). Proposals never go out without approval.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser('crm.write');
    const body = proposalCreateSchema.parse(await request.json());

    const opportunity = await opportunityRepository.getById(body.opportunity_id);
    if (!opportunity) return toErrorResponse(new Error('Opportunity not found'));

    const proposal = await proposalRepository.create({
      opportunity_id: body.opportunity_id,
      title: body.title,
      description: body.description ?? null,
      estimated_value: body.estimated_value ?? opportunity.estimated_value,
      status: 'draft',
      created_by: user.appUser.id,
    });

    const approval = await requestApproval({
      action_type: 'proposal',
      entity_type: 'proposal',
      entity_id: proposal.id,
      requested_by: user.appUser.id,
      payload: { title: proposal.title, estimated_value: proposal.estimated_value },
    });
    await proposalRepository.update(proposal.id, { status: 'pending_approval', approval_id: approval.id });

    await recordAudit({
      actor: user.appUser.id,
      action: AUDIT_ACTIONS.opportunityUpdate,
      entity: 'proposal',
      entity_id: proposal.id,
      metadata: { created: true, approval_id: approval.id },
    });

    return ok(proposal, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
