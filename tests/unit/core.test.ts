import { describe, expect, it } from 'vitest';
import { websiteEnquirySchema } from '@/validators/enquiry';
import { leadCreateSchema } from '@/validators/lead';
import { transitionApproval } from '@/services/approval-service';
import { classifyIntentByKeyword } from '@/ai/manager';
import { chunkText } from '@/services/knowledge-service';

describe('website enquiry validation (spec §45)', () => {
  it('accepts a valid enquiry and normalizes the email', () => {
    const parsed = websiteEnquirySchema.parse({
      name: '  Dr. Rao  ',
      email: 'Rao@SunriseDX.com',
      company: 'Sunrise Diagnostics',
      requirement: 'We need ECG machines for four lab sites.',
    });
    expect(parsed.email).toBe('rao@sunrisedx.com');
    expect(parsed.source).toBe('website');
  });

  it('rejects missing requirement or short name', () => {
    expect(websiteEnquirySchema.safeParse({ name: 'A', email: 'a@b.com', company: 'C', requirement: 'too short' }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ name: 'Ab', email: 'not-an-email', company: 'C', requirement: 'a long enough requirement' }).success).toBe(false);
  });

  it('rejects malformed payloads entirely', () => {
    expect(websiteEnquirySchema.safeParse(null).success).toBe(false);
    expect(websiteEnquirySchema.safeParse('string').success).toBe(false);
  });
});

describe('lead validation', () => {
  it('strips control characters from free text', () => {
    const parsed = leadCreateSchema.parse({ company: 'Acme\u0000Corp', source: 'manual' });
    expect(parsed.company).toBe('AcmeCorp');
  });

  it('requires a company name', () => {
    expect(leadCreateSchema.safeParse({ company: '' }).success).toBe(false);
  });
});

describe('approval state machine (spec §26)', () => {
  it('allows only legal transitions', () => {
    expect(transitionApproval('pending', 'approve')).toBe('approved');
    expect(transitionApproval('pending', 'reject')).toBe('rejected');
    expect(transitionApproval('approved', 'execute')).toBe('executed');
  });

  it('rejects illegal transitions', () => {
    expect(() => transitionApproval('pending', 'execute')).toThrow();
    expect(() => transitionApproval('rejected', 'approve')).toThrow();
    expect(() => transitionApproval('executed', 'reject')).toThrow();
  });
});

describe('AI intent classification (deterministic fallback)', () => {
  it('routes pipeline questions to the sales agent', () => {
    expect(classifyIntentByKeyword('Analyze the current sales pipeline')).toBe('sales');
  });

  it('routes follow-up questions to the follow-up agent', () => {
    expect(classifyIntentByKeyword('Find overdue follow-ups.')).toBe('followup');
  });

  it('routes hot-lead questions to the lead agent', () => {
    expect(classifyIntentByKeyword("Show today's hot leads.")).toBe('lead');
  });

  it('defaults to unknown when nothing matches', () => {
    expect(classifyIntentByKeyword('What is the weather?')).toBe('unknown');
  });
});

describe('knowledge chunking', () => {
  it('splits long text into ordered chunks', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} with some content about medical equipment.`).join('\n\n');
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks.every((c) => c.content.length > 0)).toBe(true);
  });

  it('returns empty for empty input', () => {
    expect(chunkText('')).toEqual([]);
  });
});
