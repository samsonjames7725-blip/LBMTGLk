import { z } from 'zod';

// Shared primitive validators (spec §78)

export const uuidSchema = z.string().uuid('Must be a valid UUID');
export const emailSchema = z.string().trim().toLowerCase().email('Must be a valid email').max(320);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\-.\s\d]{6,25}$/, 'Must be a valid phone number');
export const urlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`);
      return u.hostname.includes('.');
    } catch {
      return false;
    }
  }, 'Must be a valid URL')
  .transform((v) => (v.startsWith('http') ? v : `https://${v}`));

/** Strips control characters and trims; used on every free-text field. */
export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export const safeText = (max: number) =>
  z.string().max(max).transform(sanitizeText);
export const optionalSafeText = (max: number) =>
  z.string().max(max).nullish().transform((v) => {
    const cleaned = v == null ? null : sanitizeText(v);
    return cleaned ? cleaned : null;
  });
