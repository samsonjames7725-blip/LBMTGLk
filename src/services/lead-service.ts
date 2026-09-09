import type { Lead } from '@/types/database';
import { scoreLead, type ScoringInput, type ScoringResult } from './lead-scoring';
import type { LeadCreateInput, LeadUpdateInput } from '@/validators/lead';
import type { WebsiteEnquiryInput } from '@/validators/enquiry';
import type { SessionUser } from '@/auth/session';
import { NotFoundError } from '@/security/http';
import {
  companyRepository,
  contactRepository,
  customerRepository,
  interactionRepository,
  leadRepository,
  opportunityRepository,
} from '@/repositories/supabase';
import { recordAudit, AUDIT_ACTIONS } from './audit-service';

export interface EnquiryResult {
  lead: Lead;
  scoring: ScoringResult;
  created: boolean;
}

function scoringInputFromLead(lead: Partial<Lead>): ScoringInput {
  return {
    company: lead.company,
    contact_name: lead.contact_name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    location: lead.location,
    industry: lead.industry,
    requirement: lead.requirement,
    source: lead.source,
  };
}

/** Public website enquiry flow (spec §45): dedupe, score, log activity. */
export async function handleWebsiteEnquiry(
  input: WebsiteEnquiryInput,
  actorId: string | null = null,
): Promise<EnquiryResult> {
  const existing = input.email ? await leadRepository.findByEmail(input.email) : null;

  const payload: Partial<Lead> = {
    company: input.company,
    contact_name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    requirement: input.requirement,
    source: input.source || 'website',
  };
  const scoring = scoreLead(scoringInputFromLead(payload));

  let lead: Lead;
  let created = false;

  if (existing && existing.status !== 'converted') {
    lead = await leadRepository.update(existing.id, {
      ...payload,
      lead_score: scoring.score,
      lead_temperature: scoring.temperature,
      next_followup_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    await recordAudit({
      actor: actorId,
      action: AUDIT_ACTIONS.leadUpdate,
      entity: 'lead',
      entity_id: lead.id,
      metadata: { source: 'website_enquiry', score: scoring.score },
    });
  } else {
    lead = await leadRepository.create({
      ...payload,
      status: 'new',
      lead_score: scoring.score,
      lead_temperature: scoring.temperature,
      next_followup_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    created = true;
    await recordAudit({
      actor: actorId,
      action: AUDIT_ACTIONS.leadCreate,
      entity: 'lead',
      entity_id: lead.id,
      metadata: { source: 'website_enquiry', score: scoring.score },
    });
  }

  await interactionRepository.create({
    lead_id: lead.id,
    company_id: lead.company_id,
    type: 'website_enquiry',
    direction: 'inbound',
    subject: `Website enquiry — ${lead.company}`,
    content: input.requirement,
    created_by: actorId,
  });

  return { lead, scoring, created };
}

/** Internal lead creation (authorized users). */
export async function createLead(input: LeadCreateInput, actor: SessionUser): Promise<Lead> {
  const scoring = scoreLead(scoringInputFromLead(input));
  const lead = await leadRepository.create({
    ...input,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    status: 'new',
    lead_score: scoring.score,
    lead_temperature: scoring.temperature,
  });
  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.leadCreate,
    entity: 'lead',
    entity_id: lead.id,
    metadata: { source: lead.source, score: scoring.score },
  });
  return lead;
}

const SCORING_FIELDS: (keyof ScoringInput)[] = [
  'company',
  'contact_name',
  'email',
  'phone',
  'website',
  'location',
  'industry',
  'requirement',
  'source',
];

export async function updateLead(id: string, patch: LeadUpdateInput, actor: SessionUser): Promise<Lead> {
  const current = await leadRepository.getById(id);
  if (!current) throw new NotFoundError('Lead not found');

  const merged: Partial<Lead> = { ...current, ...patch };
  const scoringChanged = SCORING_FIELDS.some(
    (f) => (patch as Record<string, unknown>)[f] !== undefined && (patch as Record<string, unknown>)[f] !== current[f as keyof Lead],
  );

  const updatePayload: Partial<Lead> = { ...patch };
  if (scoringChanged) {
    const scoring = scoreLead(scoringInputFromLead(merged));
    updatePayload.lead_score = scoring.score;
    updatePayload.lead_temperature = scoring.temperature;
  }
  if (patch.status === 'contacted') updatePayload.last_contact_at = new Date().toISOString();

  const lead = await leadRepository.update(id, updatePayload);
  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.leadUpdate,
    entity: 'lead',
    entity_id: id,
    metadata: { fields: Object.keys(patch) },
  });
  return lead;
}

/**
 * Converts a lead into company + contact + customer + opportunity records
 * (spec §17 conversion). Only non-converted leads convert.
 */
export async function convertLead(id: string, actor: SessionUser): Promise<{
  lead: Lead;
  company_id: string;
  customer_id: string;
  opportunity_id: string;
}> {
  const lead = await leadRepository.getById(id);
  if (!lead) throw new NotFoundError('Lead not found');
  if (lead.status === 'converted') {
    throw new NotFoundError('Lead is already converted');
  }

  let company = lead.company_id
    ? await companyRepository.getById(lead.company_id)
    : await companyRepository.findByName(lead.company);
  if (!company) {
    company = await companyRepository.create({
      name: lead.company,
      website: lead.website,
      industry: lead.industry,
      location: lead.location,
      status: 'prospect',
    });
  }

  const contact =
    lead.email || lead.contact_name
      ? await contactRepository.create({
          company_id: company.id,
          name: lead.contact_name ?? lead.company,
          email: lead.email,
          phone: lead.phone,
        })
      : null;

  const customer = await customerRepository.create({
    company_id: company.id,
    primary_contact_id: contact?.id ?? null,
    customer_status: 'active',
    customer_since: new Date().toISOString().slice(0, 10),
  });

  const opportunity = await opportunityRepository.create({
    company_id: company.id,
    lead_id: lead.id,
    name: `Opportunity — ${lead.company}`,
    description: lead.requirement,
    stage: 'new',
    owner_id: actor.appUser.id,
    next_action: 'Confirm requirements from lead conversation',
  });

  const updatedLead = await leadRepository.update(id, {
    status: 'converted',
    company_id: company.id,
  });

  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.leadUpdate,
    entity: 'lead',
    entity_id: id,
    metadata: { converted: true, opportunity_id: opportunity.id },
  });

  return { lead: updatedLead, company_id: company.id, customer_id: customer.id, opportunity_id: opportunity.id };
}
