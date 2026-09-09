import type { LeadTemperature } from '@/types/database';

export interface ScoringInput {
  company?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
  industry?: string | null;
  requirement?: string | null;
  source?: string | null;
}

export interface ScoringResult {
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
  recommended_action: string;
}

const URGENT_WORDS = ['urgent', 'immediately', 'asap', 'this week', 'this month', 'next week', 'deadline', 'urgent requirement'];
const BUDGET_WORDS = ['budget', 'quotation', 'quote', 'pricing', 'cost', 'price range', 'proposal', 'estimate', 'amc'];
const MEDTECH_WORDS = ['hospital', 'clinic', 'lab', 'diagnostic', 'medical', 'healthcare', 'patient', 'surgical', 'pharma'];
const GENERIC_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com'];
const HIGH_QUALITY_SOURCES = ['referral', 'customer', 'partner'];

/**
 * Deterministic, explainable lead scoring (spec §41). Pure function — no
 * database or AI dependency, so results are reproducible and auditable.
 */
export function scoreLead(input: ScoringInput): ScoringResult {
  const reasons: string[] = [];
  let score = 0;

  // 1. Requirement completeness (up to 25)
  const requirement = (input.requirement ?? '').trim();
  if (requirement.length >= 120) {
    score += 25;
    reasons.push('Detailed requirement provided');
  } else if (requirement.length >= 40) {
    score += 15;
    reasons.push('Requirement described with moderate detail');
  } else if (requirement.length > 0) {
    score += 6;
    reasons.push('Requirement provided but lacking detail');
  } else {
    reasons.push('No requirement captured yet');
  }

  // 2. Company information (up to 15)
  let companyPoints = 0;
  if (input.company) companyPoints += 5;
  if (input.website) companyPoints += 6;
  if (input.industry) companyPoints += 4;
  score += companyPoints;
  if (companyPoints >= 11) reasons.push('Strong company information');
  else if (companyPoints >= 5) reasons.push('Partial company information');

  // 3. Contact information (up to 15)
  let contactPoints = 0;
  if (input.contact_name) contactPoints += 5;
  if (input.email) contactPoints += 6;
  if (input.phone) contactPoints += 4;
  score += contactPoints;
  if (contactPoints >= 11) reasons.push('Full contact details available');
  else if (contactPoints >= 5) reasons.push('Partial contact details');

  // 4. Decision-maker signal (up to 10)
  const lowerReq = requirement.toLowerCase();
  const seniority = /\b(director|head|manager|ceo|coo|procurement|owner|consultant|chief)\b/.test(lowerReq);
  if (input.contact_name && seniority) {
    score += 10;
    reasons.push('Decision-maker identified');
  } else if (input.contact_name) {
    score += 5;
    reasons.push('Named contact available');
  }

  // 5. Urgency (up to 15)
  const urgencyHits = URGENT_WORDS.filter((w) => lowerReq.includes(w));
  if (urgencyHits.length >= 2) {
    score += 15;
    reasons.push('High urgency expressed');
  } else if (urgencyHits.length === 1) {
    score += 9;
    reasons.push('Some urgency expressed');
  }

  // 6. Budget signal (up to 10)
  if (BUDGET_WORDS.some((w) => lowerReq.includes(w))) {
    score += 10;
    reasons.push('Budget or commercial intent indicated');
  }

  // 7. Industry relevance (up to 10)
  const industryText = `${input.industry ?? ''} ${input.company ?? ''}`.toLowerCase();
  if (MEDTECH_WORDS.some((w) => industryText.includes(w))) {
    score += 10;
    reasons.push('Industry relevant to LifeBridge MedTech');
  }

  // 8. Engagement / source quality (up to 10)
  const source = (input.source ?? '').toLowerCase();
  if (HIGH_QUALITY_SOURCES.some((s) => source.includes(s))) {
    score += 10;
    reasons.push('High-quality lead source');
  } else if (source === 'website') {
    score += 6;
    reasons.push('Inbound website enquiry');
  } else if (source) {
    score += 3;
  }

  // 9. Corporate email (up to 5, folded into contact quality)
  const domain = input.email?.split('@')[1]?.toLowerCase();
  if (domain && !GENERIC_EMAIL_DOMAINS.includes(domain)) {
    score += 5;
    reasons.push('Corporate email domain');
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const temperature: LeadTemperature = finalScore >= 70 ? 'hot' : finalScore >= 40 ? 'warm' : 'cold';

  const recommended_action =
    temperature === 'hot'
      ? 'Contact within 24 hours.'
      : temperature === 'warm'
        ? 'Follow up within 2-3 days.'
        : 'Add to nurture list; review after 7 days.';

  return { score: finalScore, temperature, reasons, recommended_action };
}
