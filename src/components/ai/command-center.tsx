'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

interface AIResponse {
  command: string;
  agent: string;
  status: string;
  result: Record<string, unknown>;
  recommended_actions: string[];
  approval_required: boolean;
  approval_id?: string | null;
  provider: { name: string; configured: boolean; model: string };
}

const SUGGESTIONS = [
  "Show today's hot leads.",
  'Find overdue follow-ups.',
  'Which opportunities need attention?',
  'Analyze the current sales pipeline.',
  "Show new leads from the website.",
];

export function CommandCenter() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api<AIResponse>('/api/ai', { method: 'POST', body: { command: trimmed } });
      setHistory((h) => [response, ...h].slice(0, 20));
      setCommand('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(command);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Ask LifeBridge AI…"
          aria-label="Ask LifeBridge AI"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Thinking…' : 'Run'}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">
            Results appear here with agent, status, recommended actions and approval requirements.
          </p>
        ) : (
          history.map((entry, i) => (
            <article key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <p className="text-sm font-medium text-slate-800">“{entry.command}”</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">{entry.agent}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{entry.status}</span>
                  {entry.approval_required ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Approval Required</span>
                  ) : null}
                </div>
              </div>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">
                {JSON.stringify(entry.result, null, 2)}
              </pre>
              {entry.recommended_actions.length > 0 ? (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended actions</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-600">
                    {entry.recommended_actions.map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
