import type { NextRequest } from 'next/server';
import { opportunityUpdateSchema } from '@/validators/work';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import { opportunityRepository } from '@/repositories/supabase';
import { recordAudit, AUDIT_ACTIONS } from '@/services/audit-service';

export const dynamic = 'force-dynamic';

/** GET /api/opportunities/:id */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const opportunity = await opportunityRepository.getById(id);
    if (!opportunity) throw new NotFoundError('Opportunity not found');
    return ok(opportunity);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/opportunities/:id — stage moves, probability, next action. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser('crm.write');
    const { id } = await params;
    const body = opportunityUpdateSchema.parse(await request.json());
    const opportunity = await opportunityRepository.update(id, body);
    await recordAudit({
      actor: user.appUser.id,
      action: AUDIT_ACTIONS.opportunityUpdate,
      entity: 'opportunity',
      entity_id: id,
      metadata: { fields: Object.keys(body) },
    });
    return ok(opportunity);
  } catch (error) {
    return toErrorResponse(error);
  }
}
