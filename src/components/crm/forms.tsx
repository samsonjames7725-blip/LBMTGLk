'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500';

/** Generic client form helper for simple POST endpoints. */
export function useApiForm(submit: (form: HTMLFormElement) => Promise<unknown>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submit(event.currentTarget);
      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, onSubmit, inputClass };
}

export function ContactCreateForm({ companyId }: { companyId?: string }) {
  const [open, setOpen] = useState(false);
  const { busy, error, onSubmit } = useApiForm(async (form) => {
    const body = Object.fromEntries(form.entries());
    await api('/api/contacts', { method: 'POST', body: { ...body, company_id: companyId || undefined } });
    setOpen(false);
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
        + New contact
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Name *" className={inputClass} aria-label="Name" />
        <input name="designation" placeholder="Designation" className={inputClass} aria-label="Designation" />
        <input name="email" type="email" placeholder="Email" className={inputClass} aria-label="Email" />
        <input name="phone" placeholder="Phone" className={inputClass} aria-label="Phone" />
        <input name="linkedin" placeholder="LinkedIn URL" className={`${inputClass} sm:col-span-2`} aria-label="LinkedIn" />
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function FollowupActions({ followupId }: { followupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/followups?id=${followupId}`, { method: 'PATCH', body });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <button type="button" disabled={busy} onClick={() => act({ status: 'completed' })} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        Complete
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const next = prompt('Reschedule to (YYYY-MM-DD):', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
          if (next) act({ scheduled_at: new Date(next).toISOString() });
        }}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        Reschedule
      </button>
      <button type="button" disabled={busy} onClick={() => act({ status: 'cancelled' })} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50">
        Cancel
      </button>
    </div>
  );
}

export function TaskCreateForm() {
  const [open, setOpen] = useState(false);
  const { busy, error, onSubmit } = useApiForm(async (form) => {
    const body = Object.fromEntries(form.entries());
    await api('/api/tasks', { method: 'POST', body });
    setOpen(false);
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
        + New task
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" required placeholder="Title *" className={`${inputClass} sm:col-span-2`} aria-label="Title" />
        <textarea name="description" placeholder="Description" rows={2} className={`${inputClass} sm:col-span-2`} aria-label="Description" />
        <select name="priority" className={inputClass} aria-label="Priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input name="due_date" type="date" className={inputClass} aria-label="Due date" />
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create task'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TaskCompleteButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/tasks?id=${taskId}`, { method: 'PATCH', body: { status: 'completed' } });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      Complete
    </button>
  );
}

export function OpportunityStageSelect({ opportunityId, stage, disabled }: { opportunityId: string; stage: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <select
      aria-label="Stage"
      disabled={disabled || busy}
      defaultValue={stage}
      onChange={async (e) => {
        setBusy(true);
        try {
          await api(`/api/opportunities/${opportunityId}`, { method: 'PATCH', body: { stage: e.target.value } });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
    >
      {['new', 'qualified', 'contacted', 'requirement_confirmed', 'proposal_required', 'proposal_sent', 'negotiation', 'won', 'lost'].map((s) => (
        <option key={s} value={s}>
          {s.replaceAll('_', ' ')}
        </option>
      ))}
    </select>
  );
}

export function ProposalCreateForm({ opportunities }: { opportunities: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const { busy, error, onSubmit } = useApiForm(async (form) => {
    const raw = Object.fromEntries(form.entries());
    await api('/api/proposals', {
      method: 'POST',
      body: {
        opportunity_id: raw.opportunity_id,
        title: raw.title,
        description: raw.description || undefined,
        estimated_value: raw.estimated_value ? Number(raw.estimated_value) : undefined,
      },
    });
    setOpen(false);
  });

  if (opportunities.length === 0) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
        + New proposal
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="opportunity_id" required className={inputClass} aria-label="Opportunity">
          {opportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Title *" className={inputClass} aria-label="Title" />
        <input name="estimated_value" type="number" min="0" placeholder="Estimated value" className={inputClass} aria-label="Estimated value" />
        <textarea name="description" placeholder="Description" rows={2} className={`${inputClass} sm:col-span-2`} aria-label="Description" />
      </div>
      <p className="mt-2 text-xs text-slate-400">Proposals are created as drafts and immediately queued for approval (pending_approval).</p>
      {error ? <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create proposal'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApprovalActions({ approvalId, canReview }: { approvalId: string; canReview: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/approvals/${approvalId}/${path}`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!canReview) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button type="button" disabled={busy} onClick={() => act('approve')} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          Approve
        </button>
        <button type="button" disabled={busy} onClick={() => act('reject')} className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
          Reject
        </button>
      </div>
      {error ? <p role="alert" className="max-w-xs text-right text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function KnowledgeActions({ documentId, status, canManage }: { documentId: string; status: string; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!canManage || status !== 'pending') return null;

  async function act(action: string) {
    setBusy(true);
    try {
      await api(`/api/knowledge/${documentId}`, { method: 'POST', body: { action } });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <button type="button" disabled={busy} onClick={() => act('approve')} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        Approve
      </button>
      <button type="button" disabled={busy} onClick={() => act('reject')} className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
