import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { opportunityRepository } from '@/repositories/supabase';
import { recordAudit, AUDIT_ACTIONS } from '@/services/audit-service';
import type { Opportunity } from '@/types/database';

export const dynamic = 'force-dynamic';

/** GET /api/opportunities — list (optionally filtered by stage). */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser('crm.read');
    const stageParam = request.nextUrl.searchParams.get('stage');
    const stage = OPPORTUNITY_STAGES.includes(stageParam as Opportunity['stage'])
      ? (stageParam as Opportunity['stage'])
      : undefined;
    const opportunities = await opportunityRepository.list({ stage, limit: 500 });
    return ok({ items: opportunities, total: opportunities.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const OPPORTUNITY_STAGES: Opportunity['stage'][] = [
  'new',
  'qualified',
  'contacted',
  'requirement_confirmed',
  'proposal_required',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
];

/** POST /api/opportunities — create (also available via lead conversion). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser('crm.write');
    const body = await request.json();
    const opportunity = await opportunityRepository.create({
      company_id: body.company_id,
      lead_id: body.lead_id ?? null,
      name: body.name,
      description: body.description ?? null,
      stage: 'new',
      estimated_value: body.estimated_value ?? null,
      probability: body.probability ?? null,
      expected_close_date: body.expected_close_date ?? null,
      owner_id: user.appUser.id,
      next_action: body.next_action ?? null,
    });
    await recordAudit({ actor: user.appUser.id, action: AUDIT_ACTIONS.opportunityCreate, entity: 'opportunity', entity_id: opportunity.id });
    return ok(opportunity, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
