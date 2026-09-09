'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

const STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];
const TEMPERATURES = ['hot', 'warm', 'cold'];

export function LeadFilters({ initial }: { initial: { search?: string; status?: string; temperature?: string; sort?: string } }) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.search ?? '');

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { search, status: initial.status, temperature: initial.temperature, sort: initial.sort, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    router.push(`/leads?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply({});
      }}
    >
      <input
        type="search"
        aria-label="Search leads"
        placeholder="Search company, contact, email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      <select
        aria-label="Filter by status"
        value={initial.status ?? ''}
        onChange={(e) => apply({ status: e.target.value })}
        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by temperature"
        value={initial.temperature ?? ''}
        onChange={(e) => apply({ temperature: e.target.value })}
        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="">All temperatures</option>
        {TEMPERATURES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort"
        value={initial.sort ?? 'created_at'}
        onChange={(e) => apply({ sort: e.target.value })}
        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="created_at">Newest first</option>
        <option value="lead_score">Highest score</option>
        <option value="company">Company A–Z</option>
      </select>
      <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Apply
      </button>
    </form>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500';

export function NewLeadForm({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/api/leads', {
        method: 'POST',
        body: Object.fromEntries(form.entries()),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        + New lead
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input name="company" required placeholder="Company *" className={inputClass} aria-label="Company" />
        <input name="contact_name" placeholder="Contact name" className={inputClass} aria-label="Contact name" />
        <input name="email" type="email" placeholder="Email" className={inputClass} aria-label="Email" />
        <input name="phone" placeholder="Phone" className={inputClass} aria-label="Phone" />
        <input name="website" placeholder="Website" className={inputClass} aria-label="Website" />
        <input name="location" placeholder="Location" className={inputClass} aria-label="Location" />
        <input name="industry" placeholder="Industry" className={inputClass} aria-label="Industry" />
        <input name="source" placeholder="Source (default: manual)" className={inputClass} aria-label="Source" />
        <textarea name="requirement" placeholder="Requirement" className={`${inputClass} sm:col-span-2 lg:col-span-3`} rows={3} aria-label="Requirement" />
      </div>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create lead'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LeadActions({ leadId, status, canWrite, canDelete }: { leadId: string; status: string; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWrite && status !== 'converted' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => api(`/api/leads/${leadId}/convert`, { method: 'POST' }))}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Convert to customer
        </button>
      ) : null}
      {canWrite && !['contacted', 'qualified'].includes(status) ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => api(`/api/leads/${leadId}`, { method: 'PATCH', body: { status: 'contacted' } }))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Mark contacted
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm('Delete this lead? This cannot be undone.')) run(() => api(`/api/leads/${leadId}`, { method: 'DELETE' }));
          }}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          Delete
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
