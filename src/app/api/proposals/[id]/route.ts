import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, NotFoundError } from '@/security/http';
import { proposalRepository, opportunityRepository } from '@/repositories/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/proposals/:id — proposal with its opportunity. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser('crm.read');
    const { id } = await params;
    const proposal = await proposalRepository.getById(id);
    if (!proposal) throw new NotFoundError('Proposal not found');
    const opportunity = proposal.opportunity_id ? await opportunityRepository.getById(proposal.opportunity_id) : null;
    return ok({ proposal, opportunity });
  } catch (error) {
    return toErrorResponse(error);
  }
}
