import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse, fail } from '@/security/http';
import { knowledgeRepository } from '@/repositories/supabase';
import { getAdminClient, ConfigurationError } from '@/supabase/server';
import { knowledgeMetadataSchema } from '@/validators/work';
import { registerDocument } from '@/services/knowledge-service';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['pdf', 'docx', 'xlsx', 'txt', 'md'];

/** GET /api/knowledge — document list (pending docs filtered by RLS/policies). */
export async function GET() {
  try {
    await requireApiUser('crm.read');
    const documents = await knowledgeRepository.listDocuments(undefined, 200);
    return ok({ items: documents, total: documents.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/knowledge — multipart upload to the private `company-knowledge`
 * bucket. Documents start as `pending`; only approved documents become
 * active AI knowledge (spec §44).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser('knowledge.manage');
    const form = await request.formData();
    const file = form.get('file');
    const meta = knowledgeMetadataSchema.parse({
      category: form.get('category'),
      description: form.get('description') || null,
    });

    if (!(file instanceof File)) {
      return fail('VALIDATION_ERROR', 'file field is required', 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'File exceeds the 20 MB limit', 413);
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_TYPES.includes(ext)) {
      return fail('UNSUPPORTED_TYPE', `Allowed types: ${ALLOWED_TYPES.join(', ')}`, 415);
    }

    const storagePath = `${user.appUser.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const admin = getAdminClient();
    const { error } = await admin.storage
      .from('company-knowledge')
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream' });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const document = await registerDocument({
      filename: file.name,
      category: meta.category,
      description: meta.description ?? null,
      storagePath,
      uploadedBy: user.appUser.id,
    });

    return ok(document, 201);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return fail('CONFIGURATION_ERROR', 'Database is not configured', 503);
    }
    return toErrorResponse(error);
  }
}
