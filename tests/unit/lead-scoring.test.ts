import { describe, expect, it } from 'vitest';
import { scoreLead } from '@/services/lead-scoring';

describe('scoreLead (deterministic, explainable)', () => {
  it('scores a complete hot lead with all signals', () => {
    const result = scoreLead({
      company: 'Apollo Hospital',
      website: 'https://apollohospitals.com',
      industry: 'Healthcare',
      contact_name: 'Dr. Rajesh Head of Procurement',
      email: 'rajesh@apollohospitals.com',
      phone: '+91 9876543210',
      requirement:
        'Urgent requirement for patient monitoring systems across three departments. We need a quotation this week with pricing; the director has approved budget and we need installation asap.',
      source: 'referral',
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.temperature).toBe('hot');
    expect(result.recommended_action).toBe('Contact within 24 hours.');
    expect(result.reasons.length).toBeGreaterThan(3);
  });

  it('scores an empty lead as cold with honest reasons', () => {
    const result = scoreLead({});
    expect(result.score).toBe(0);
    expect(result.temperature).toBe('cold');
    expect(result.reasons).toContain('No requirement captured yet');
    expect(result.recommended_action).toBe('Add to nurture list; review after 7 days.');
  });

  it('marks a partial lead as warm', () => {
    const result = scoreLead({
      company: 'City Clinic',
      email: 'info@cityclinic.in',
      requirement: 'We are looking for diagnostic equipment for our new lab.',
      source: 'website',
    });
    expect(result.temperature).toBe('warm');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(70);
  });

  it('never exceeds 0–100 and maps thresholds correctly', () => {
    const maxed = scoreLead({
      company: 'Hospital Lab',
      website: 'https://hospitallab.com',
      industry: 'hospital',
      contact_name: 'Priya Director',
      email: 'priya@hospitallab.com',
      phone: '+91 9000000000',
      requirement:
        'Urgent, asap: need quotation and pricing immediately this week. The head of procurement has budget approved and needs an estimate for the deadline next week for our diagnostic lab.',
      source: 'customer referral',
    });
    expect(maxed.score).toBeLessThanOrEqual(100);
    expect(maxed.temperature).toBe('hot');
  });

  it('treats generic email domains as weaker signals than corporate ones', () => {
    const generic = scoreLead({ email: 'someone@gmail.com' });
    const corporate = scoreLead({ email: 'someone@medtechcompany.in' });
    expect(corporate.score).toBeGreaterThan(generic.score);
  });
});
