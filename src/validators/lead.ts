import { z } from 'zod';
import { leadStatusSchema, leadTemperatureSchema } from './enums';
import { emailSchema, optionalSafeText, phoneSchema, safeText, sanitizeText, urlSchema } from './common';

export const leadCreateSchema = z.object({
  company: safeText(200).pipe(z.string().min(1, 'Company is required')),
  contact_name: optionalSafeText(160),
  email: emailSchema.nullish(),
  phone: phoneSchema.nullish(),
  website: urlSchema.nullish(),
  location: optionalSafeText(200),
  industry: optionalSafeText(120),
  requirement: optionalSafeText(5000),
  source: safeText(80).default('manual'),
  notes: optionalSafeText(5000),
});

export const leadUpdateSchema = z.object({
  company: safeText(200).optional(),
  contact_name: optionalSafeText(160).optional(),
  email: emailSchema.nullish(),
  phone: phoneSchema.nullish(),
  website: urlSchema.nullish(),
  location: optionalSafeText(200).optional(),
  industry: optionalSafeText(120).optional(),
  requirement: optionalSafeText(5000).optional(),
  source: safeText(80).optional(),
  status: leadStatusSchema.optional(),
  lead_temperature: leadTemperatureSchema.optional(),
  next_followup_at: z.string().datetime({ offset: true }).nullish(),
  notes: optionalSafeText(5000).optional(),
});

export const leadListQuerySchema = z.object({
  search: z.string().max(160).transform(sanitizeText).optional(),
  status: leadStatusSchema.optional(),
  temperature: leadTemperatureSchema.optional(),
  source: z.string().max(80).transform(sanitizeText).optional(),
  sort: z.enum(['created_at', 'lead_score', 'company']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
