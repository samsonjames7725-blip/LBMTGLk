import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { knowledgeRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, Card, EmptyState, NotConfiguredState, PageHeader, Table, formatDate } from '@/components/ui/primitives';
import { KnowledgeUploadForm } from '@/components/knowledge/upload-form';
import { KnowledgeActions } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Company Knowledge' };
export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  let documents, canManage;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    canManage = user.permissions.includes('knowledge.manage');
    documents = await knowledgeRepository.listDocuments(undefined, 200);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Company Knowledge" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Company Knowledge"
        subtitle="Only approved documents feed production AI (spec §42/§43)"
        actions={<KnowledgeUploadForm canManage={canManage} />}
      />

      <Card className="mb-5">
        <p className="text-sm text-slate-600">
          When information is unavailable in approved knowledge, AI responses must state:{' '}
          <em>“Information not available in approved company knowledge.”</em> The AI never fabricates product
          specifications, certifications, warranties, prices, customer history, regulatory or medical claims.
        </p>
      </Card>

      {documents.length === 0 ? (
        <EmptyState title="No documents yet" hint="Upload company profiles, product specs, certifications, SOPs and FAQs." />
      ) : (
        <Table head={['Filename', 'Category', 'Status', 'Uploaded', 'Actions']}>
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <p className="font-medium text-slate-700">{doc.filename}</p>
                {doc.description ? <p className="text-xs text-slate-400">{doc.description}</p> : null}
              </td>
              <td className="px-4 py-2.5 text-slate-500">{doc.category.replaceAll('_', ' ')}</td>
              <td className="px-4 py-2.5">
                <Badge label={doc.approval_status === 'approved' ? 'approved' : doc.approval_status === 'pending' ? 'pending' : 'rejected'} />
              </td>
              <td className="px-4 py-2.5 text-slate-400">{formatDate(doc.created_at)}</td>
              <td className="px-4 py-2.5">
                <KnowledgeActions documentId={doc.id} status={doc.approval_status} canManage={canManage} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
