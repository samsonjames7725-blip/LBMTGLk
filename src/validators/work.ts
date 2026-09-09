import { z } from 'zod';
import { safeText } from './common';
import { followupTypeSchema, knowledgeCategorySchema, prioritySchema } from './enums';

export const aiCommandSchema = z.object({
  command: safeText(2000).pipe(z.string().min(3, 'Command is required')),
});

export const followupCreateSchema = z.object({
  lead_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  opportunity_id: z.string().uuid().nullish(),
  followup_type: followupTypeSchema.default('call'),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  priority: prioritySchema.default('medium'),
  assigned_to: z.string().uuid().nullish(),
});

export const followupUpdateSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  priority: prioritySchema.optional(),
  assigned_to: z.string().uuid().nullish().optional(),
});

export const taskCreateSchema = z.object({
  title: safeText(300).pipe(z.string().min(1, 'Title is required')),
  description: safeText(5000).nullish(),
  priority: prioritySchema.default('medium'),
  assigned_to: z.string().uuid().nullish(),
  lead_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  opportunity_id: z.string().uuid().nullish(),
  due_date: z.string().datetime({ offset: true }).nullish(),
});

export const taskUpdateSchema = z.object({
  status: taskStatusEnum().optional(),
  priority: prioritySchema.optional(),
});

function taskStatusEnum() {
  return z.enum(['todo', 'in_progress', 'completed', 'cancelled']);
}

export const proposalCreateSchema = z.object({
  opportunity_id: z.string().uuid(),
  title: safeText(300).pipe(z.string().min(1, 'Title is required')),
  description: safeText(20000).nullish(),
  estimated_value: z.number().nonnegative().max(1_000_000_000).nullish(),
});

export const opportunityUpdateSchema = z.object({
  stage: z
    .enum([
      'new',
      'qualified',
      'contacted',
      'requirement_confirmed',
      'proposal_required',
      'proposal_sent',
      'negotiation',
      'won',
      'lost',
    ])
    .optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().date().nullish().optional(),
  next_action: safeText(500).nullish().optional(),
  owner_id: z.string().uuid().nullish().optional(),
});

export const knowledgeMetadataSchema = z.object({
  category: knowledgeCategorySchema,
  description: safeText(500).nullish(),
});

export type FollowupCreateInput = z.infer<typeof followupCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type ProposalCreateInput = z.infer<typeof proposalCreateSchema>;
