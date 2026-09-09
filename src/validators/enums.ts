import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
]);

export const leadTemperatureSchema = z.enum(['hot', 'warm', 'cold']);

export const opportunityStageSchema = z.enum([
  'new',
  'qualified',
  'contacted',
  'requirement_confirmed',
  'proposal_required',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
]);

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'completed', 'cancelled']);
export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const followupStatusSchema = z.enum(['pending', 'completed', 'cancelled', 'overdue']);
export const followupTypeSchema = z.enum(['call', 'email', 'whatsapp', 'meeting', 'other']);
export const interactionTypeSchema = z.enum([
  'phone_call',
  'meeting',
  'email',
  'whatsapp_note',
  'website_enquiry',
  'internal_note',
]);
export const emailStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'received',
  'failed',
]);
export const proposalStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'accepted',
  'rejected',
]);
export const approvalActionTypeSchema = z.enum([
  'outbound_sales_email',
  'whatsapp_message',
  'quotation',
  'proposal',
  'website_publish',
  'pricing_change',
  'customer_commitment',
]);
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'executed']);
export const knowledgeCategorySchema = z.enum([
  'company_profile',
  'products',
  'product_specifications',
  'services',
  'certifications',
  'warranty',
  'previous_proposals',
  'sops',
  'faqs',
]);
export const agentTaskTypeSchema = z.enum([
  'lead',
  'sales',
  'followup',
  'email',
  'proposal',
  'analytics',
  'report',
  'customer_success',
  'unknown',
]);
