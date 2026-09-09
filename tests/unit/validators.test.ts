import { describe, expect, it } from 'vitest';
import { leadCreateSchema, leadListQuerySchema, leadUpdateSchema } from '@/validators/lead';
import { leadStatusSchema } from '@/validators/enums';

describe('leadCreateSchema', () => {
  it('accepts a valid lead and normalizes contact fields', () => {
    const parsed = leadCreateSchema.parse({
      company: '  Apollo Hospitals  ',
      email: 'Contact@ApolloHospitals.COM',
      website: 'apollohospitals.com',
      phone: '+91 98765-43210',
    });
    expect(parsed.company).toBe('Apollo Hospitals');
    expect(parsed.email).toBe('contact@apollohospitals.com');
    expect(parsed.website).toBe('https://apollohospitals.com');
    expect(parsed.source).toBe('manual');
  });

  it('rejects a missing company and an invalid email', () => {
    expect(leadCreateSchema.safeParse({ company: '' }).success).toBe(false);
    expect(leadCreateSchema.safeParse({ company: 'X', email: 'not-an-email' }).success).toBe(false);
  });

  it('strips control characters from free text', () => {
    const parsed = leadCreateSchema.parse({ company: 'A\u0000B\u0007C' });
    expect(parsed.company).toBe('ABC');
  });
});

describe('leadUpdateSchema', () => {
  it('accepts status and temperature transitions from the allowed sets', () => {
    expect(leadUpdateSchema.safeParse({ status: 'qualified', lead_temperature: 'hot' }).success).toBe(true);
    expect(leadUpdateSchema.safeParse({ status: 'exploded' }).success).toBe(false);
    expect(leadStatusSchema.safeParse('converted').success).toBe(true);
  });

  it('requires an ISO datetime with offset for next_followup_at', () => {
    expect(leadUpdateSchema.safeParse({ next_followup_at: '2026-09-10T10:00:00Z' }).success).toBe(true);
    expect(leadUpdateSchema.safeParse({ next_followup_at: 'tomorrow' }).success).toBe(false);
  });
});

describe('leadListQuerySchema', () => {
  it('coerces and clamps pagination inputs', () => {
    const parsed = leadListQuerySchema.parse({ limit: '25', offset: '5' });
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(5);
    expect(parsed.sort).toBe('created_at');
    expect(parsed.order).toBe('desc');
  });

  it('rejects out-of-range limits and bad sort fields', () => {
    expect(leadListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(leadListQuerySchema.safeParse({ sort: 'password_hash' }).success).toBe(false);
  });
});
