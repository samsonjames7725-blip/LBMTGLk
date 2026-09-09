import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2> : null}
      {children}
    </section>
  );
}

const BADGE_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 ring-red-200',
  warm: 'bg-amber-100 text-amber-700 ring-amber-200',
  cold: 'bg-sky-100 text-sky-700 ring-sky-200',
  new: 'bg-slate-100 text-slate-600 ring-slate-200',
  contacted: 'bg-sky-100 text-sky-700 ring-sky-200',
  qualified: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  unqualified: 'bg-slate-100 text-slate-500 ring-slate-200',
  converted: 'bg-brand-100 text-brand-700 ring-brand-200',
  lost: 'bg-rose-100 text-rose-700 ring-rose-200',
  won: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-100 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 ring-rose-200',
  executed: 'bg-brand-100 text-brand-700 ring-brand-200',
  overdue: 'bg-rose-100 text-rose-700 ring-rose-200',
  completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  pending_approval: 'bg-amber-100 text-amber-700 ring-amber-200',
  sent: 'bg-sky-100 text-sky-700 ring-sky-200',
  received: 'bg-sky-100 text-sky-700 ring-sky-200',
  failed: 'bg-rose-100 text-rose-700 ring-rose-200',
  accepted: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  todo: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-sky-100 text-sky-700 ring-sky-200',
  urgent: 'bg-rose-100 text-rose-700 ring-rose-200',
  high: 'bg-orange-100 text-orange-700 ring-orange-200',
  medium: 'bg-sky-100 text-sky-700 ring-sky-200',
  low: 'bg-slate-100 text-slate-500 ring-slate-200',
  'NOT IMPLEMENTED': 'bg-slate-100 text-slate-500 ring-slate-200',
  ACTIVE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'ACTIVE / DRAFT ONLY': 'bg-amber-100 text-amber-700 ring-amber-200',
};

export function Badge({ label }: { label: string }) {
  const style = BADGE_STYLES[label] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {label.replaceAll('_', ' ')}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-sm text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-10 text-center">
      <p className="font-medium text-rose-700">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-sm text-rose-500">{hint}</p> : null}
    </div>
  );
}

export function NotConfiguredState({ feature = 'Database' }: { feature?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
      <p className="font-semibold text-amber-800">{feature}: NOT CONFIGURED</p>
      <p className="mt-1 max-w-md text-sm text-amber-600">
        Server environment variables (SUPABASE_SECRET_KEY) are missing, so live data is unavailable. Set them in the
        hosting provider and reload.
      </p>
    </div>
  );
}

export function KpiCard({ label, value, tone = 'default', hint }: { label: string; value: string | number; tone?: 'default' | 'alert' | 'good'; hint?: string }) {
  const toneClass =
    tone === 'alert' ? 'text-rose-600' : tone === 'good' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function SimpleBarChart({ data, valueFormat }: { data: { label: string; value: number }[]; valueFormat?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs text-slate-500" title={d.label}>
            {d.label.replaceAll('_', ' ')}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">
            {valueFormat ? valueFormat(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMoney(value: number | null | undefined, currency = 'INR'): string {
  if (value == null) return '—';
  return `${currency} ${value.toLocaleString('en-IN')}`;
}
