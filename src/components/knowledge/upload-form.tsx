'use client';

import { useRef } from 'react';
import { api } from '@/lib/client';

const CATEGORIES = [
  'company_profile',
  'products',
  'product_specifications',
  'services',
  'certifications',
  'warranty',
  'previous_proposals',
  'sops',
  'faqs',
];

export function KnowledgeUploadForm({ canManage }: { canManage: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  if (!canManage) return null;

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        try {
          await api('/api/knowledge', { method: 'POST', formData });
          formRef.current?.reset();
          location.reload();
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Upload failed');
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <label htmlFor="file" className="mb-1 block text-xs font-medium text-slate-500">
          Document (PDF, DOCX, XLSX, TXT, MD — max 20 MB)
        </label>
        <input id="file" name="file" type="file" required accept=".pdf,.docx,.xlsx,.txt,.md" className="text-sm" />
      </div>
      <div>
        <label htmlFor="category" className="mb-1 block text-xs font-medium text-slate-500">
          Category
        </label>
        <select id="category" name="category" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="description" className="mb-1 block text-xs font-medium text-slate-500">
          Description
        </label>
        <input id="description" name="description" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Upload
      </button>
    </form>
  );
}
