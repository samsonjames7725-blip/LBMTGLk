import { z } from 'zod';
import { emailSchema, optionalSafeText, phoneSchema, safeText, urlSchema } from './common';

/** Public website enquiry payload (spec §45) — strictly validated. */
export const websiteEnquirySchema = z.object({
  name: safeText(160).pipe(z.string().min(2, 'Name is required')),
  email: emailSchema,
  phone: phoneSchema.optional(),
  company: safeText(200).pipe(z.string().min(1, 'Company is required')),
  requirement: safeText(5000).pipe(z.string().min(10, 'Please describe your requirement (min 10 characters)')),
  source: safeText(80).default('website'),
  website: urlSchema.optional(),
});

export type WebsiteEnquiryInput = z.infer<typeof websiteEnquirySchema>;
export type { optionalSafeText };
