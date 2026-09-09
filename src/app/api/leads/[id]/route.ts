import type { NextRequest } from 'next/server';
import { leadUpdateSchema } from '@/validators/lead';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError, ForbiddenError } from '@/security/http';
import { updateLead } from '@/services/lead-service';
import { leadRepository, interactionRepository, taskRepository, followupRepository, opportunityRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/leads/:id — lead profile with related activity. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const lead = await leadRepository.getById(id);
    if (!lead) throw new NotFoundError('Lead not found');
    const [interactions, tasks, followups, opportunities] = await Promise.all([
      interactionRepository.listByLead(id),
      taskRepository.list({ leadId: id }),
      followupRepository.list({ leadId: id }),
      opportunityRepository.list({ limit: 200 }),
    ]);
    return ok({
      lead,
      interactions,
      tasks,
      followups,
      opportunity: opportunities.find((o) => o.lead_id === id) ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/leads/:id — update fields; re-scores when relevant fields change. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser('crm.write');
    const { id } = await params;
    const body = leadUpdateSchema.parse(await request.json());
    const lead = await updateLead(id, body, user);
    return ok(lead);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/leads/:id — restricted to leads.delete permission (spec §17). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser('leads.delete');
    const { id } = await params;
    void user;
    // Deletes are performed through the server layer only; repository uses
    // the admin client. Leads are soft-locked by audit requirements, so this
    // performs a hard delete only for records with no opportunities.
    const opportunities = await opportunityRepository.list({ limit: 500 });
    if (opportunities.some((o) => o.lead_id === id)) {
      throw new ForbiddenError('Lead has linked opportunities and cannot be deleted.');
    }
    const admin = (await import('@/supabase/server')).getAdminClient();
    const { error } = await admin.from('leads').delete().eq('id', id);
    if (error) throw error;
    return ok({ deleted: id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
