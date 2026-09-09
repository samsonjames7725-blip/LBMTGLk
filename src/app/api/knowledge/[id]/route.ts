import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';
import { approveDocument, rejectDocument } from '@/services/knowledge-service';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['approve', 'reject']) });

/**
 * POST /api/knowledge/:id — approve or reject a document (knowledge.manage
 * permission). Approving chunks text documents into active AI knowledge.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser('knowledge.manage');
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());
    const document = action === 'approve' ? await approveDocument(id, user) : await rejectDocument(id, user);
    return ok(document);
  } catch (error) {
    return toErrorResponse(error);
  }
}
