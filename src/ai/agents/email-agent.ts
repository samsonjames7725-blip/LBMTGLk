import type { AIProvider } from '@/ai/provider';
import { emailRepository, knowledgeRepository, leadRepository } from '@/repositories/supabase';
import { NotFoundError } from '@/security/http';
import { requestApproval } from '@/services/approval-service';
import { AUDIT_ACTIONS, recordAudit } from '@/services/audit-service';
import type { Agent, AgentResult } from './types';
import { textAfter } from './types';

/**
 * Email Agent (spec §38, ACTIVE — DRAFT ONLY). Creates drafts and approval
 * requests. It can never send external email (spec §55/§101).
 */
export const emailAgent: Agent = {
  name: 'email',
  taskType: 'email',
  description: 'Email drafting and personalization. Draft-only: every outbound draft requires human approval.',

  async handle(command: string, user, provider: AIProvider): Promise<AgentResult> {
    const ref = textAfter(command.toLowerCase(), 'to ') ?? command;
    const lead = await resolveLead(ref);
    if (!lead) {
      throw new NotFoundError(
        'Could not resolve a lead from the command. Mention the lead company name or email, e.g. "Draft an email to Acme Labs".',
      );
    }

    // Only APPROVED company knowledge may inform drafts (spec §42/§43).
    const knowledgeSnippets = await knowledgeRepository.searchChunks(
      (lead.requirement ?? lead.company).slice(0, 100),
      3,
    );
    const approvedDocs = new Set(
      (await knowledgeRepository.listDocuments('approved', 500)).map((d) => d.id),
    );
    const safeKnowledge = knowledgeSnippets.filter((c) => approvedDocs.has(c.document_id));

    const knowledgeContext = safeKnowledge.map((c) => c.content).join('\n---\n');
    const draft = await provider.generateText(
      [
        `Write a concise B2B sales email.`,
        `Recipient contact: ${lead.contact_name ?? 'contact'} at ${lead.company}.`,
        `Their requirement: ${lead.requirement ?? 'not stated — ask a clarifying question'}.`,
        knowledgeContext ? `Use ONLY the approved company knowledge below; if information is missing, write "Information not available in approved company knowledge." and do not invent facts:\n${knowledgeContext}` : `No approved company knowledge is available — do not state any product specifications, prices, certifications, or medical claims.`,
      ].join('\n\n'),
      {
        system:
          'You draft professional sales emails for a medical equipment company. Never fabricate product specifications, certifications, warranties, prices, customer history, regulatory or medical claims. If asked for unavailable facts, state that the information is not available in approved company knowledge.',
      },
    );

    const email = await emailRepository.create({
      lead_id: lead.id,
      direction: 'outbound',
      to_address: lead.email,
      subject: `Following up on your enquiry — ${lead.company}`,
      body: `AI Draft\n${draft}`,
      status: 'draft',
    });

    const approval = await requestApproval({
      action_type: 'outbound_sales_email',
      entity_type: 'email',
      entity_id: email.id,
      requested_by: user.appUser.id,
      payload: { subject: email.subject, to: email.to_address, source: 'email_agent' },
    });
    await emailRepository.update(email.id, { status: 'pending_approval', approval_id: approval.id });
    await recordAudit({
      actor: user.appUser.id,
      action: AUDIT_ACTIONS.emailDraft,
      entity: 'email',
      entity_id: email.id,
      metadata: { via: 'email_agent', approval_id: approval.id },
    });

    return {
      summary: `Draft email prepared for ${lead.company} and queued for human approval. External sending stays disabled (DRAFT_ONLY).`,
      data: { email_id: email.id, lead_id: lead.id, subject: email.subject, body: email.body },
      recommended_actions: ['Review the draft in the Approval Center and edit if needed before approving.'],
      approval_required: true,
      approval_id: approval.id,
    };
  },
};

async function resolveLead(ref: string) {
  const emailMatch = ref.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) {
    const byEmail = await leadRepository.findByEmail(emailMatch[0]);
    if (byEmail) return byEmail;
  }
  const { items } = await leadRepository.list({ search: ref.replace(/["'`]/g, '').slice(0, 60), limit: 1 });
  return items[0] ?? null;
}
