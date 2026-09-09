import type { KnowledgeCategory } from '@/types/database';
import { knowledgeRepository } from '@/repositories/supabase';
import { recordAudit, AUDIT_ACTIONS } from './audit-service';
import type { SessionUser } from '@/auth/session';

const CHUNK_TARGET = 900;
const CHUNK_OVERLAP = 120;

export function chunkText(text: string): { index: number; content: string }[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_TARGET, clean.length);
    let boundary = clean.lastIndexOf('\n', end);
    if (boundary <= start) boundary = clean.lastIndexOf('. ', end);
    const sliceEnd = boundary > start ? Math.min(boundary + 1, end) : end;
    chunks.push(clean.slice(start, sliceEnd).trim());
    start = sliceEnd - CHUNK_OVERLAP > start ? sliceEnd - CHUNK_OVERLAP : sliceEnd;
    if (sliceEnd >= clean.length) break;
  }
  return chunks.filter(Boolean).map((content, index) => ({ index, content }));
}

export async function registerDocument(input: {
  filename: string;
  category: KnowledgeCategory;
  description: string | null;
  storagePath: string;
  uploadedBy: string;
}) {
  const doc = await knowledgeRepository.createDocument({
    filename: input.filename,
    category: input.category,
    description: input.description,
    storage_path: input.storagePath,
    uploaded_by: input.uploadedBy,
    approval_status: 'pending',
  });
  await recordAudit({
    actor: input.uploadedBy,
    action: AUDIT_ACTIONS.knowledgeUploaded,
    entity: 'knowledge_document',
    entity_id: doc.id,
    metadata: { category: input.category, filename: input.filename },
  });
  return doc;
}

/**
 * Approving a document makes it active AI knowledge (spec §44). Text-based
 * documents are chunked into knowledge_chunks at approval time.
 */
export async function approveDocument(id: string, actor: SessionUser) {
  const doc = await knowledgeRepository.getDocument(id);
  if (!doc) throw new Error('Document not found');
  const updated = await knowledgeRepository.setDocumentStatus(id, 'approved');

  if (/\.(txt|md)$/i.test(doc.filename)) {
    const admin = (await import('@/supabase/server')).tryGetAdminClient();
    if (admin) {
      const { data } = await admin.storage.from('company-knowledge').download(doc.storage_path);
      if (data) {
        const text = await data.text();
        const chunks = chunkText(text);
        if (chunks.length > 0) await knowledgeRepository.createChunks(id, chunks);
      }
    }
  }

  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.knowledgeApproved,
    entity: 'knowledge_document',
    entity_id: id,
    metadata: { approved: true },
  });
  return updated;
}

export async function rejectDocument(id: string, actor: SessionUser) {
  const updated = await knowledgeRepository.setDocumentStatus(id, 'rejected');
  await recordAudit({
    actor: actor.appUser.id,
    action: AUDIT_ACTIONS.knowledgeApproved,
    entity: 'knowledge_document',
    entity_id: id,
    metadata: { approved: false },
  });
  return updated;
}
