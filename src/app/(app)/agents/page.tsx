import type { Metadata } from 'next';
import { AGENT_REGISTRY } from '@/ai/manager';
import { getAIProvider } from '@/ai/provider';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Agents' };

export default function AgentsPage() {
  const provider = getAIProvider();
  const implemented = AGENT_REGISTRY.filter((a) => a.status !== 'NOT IMPLEMENTED');

  return (
    <>
      <PageHeader
        title="AI Agents"
        subtitle="Modular agent registry — future agents plug in without architectural rewrites"
      />

      <Card title="AI Provider" className="mb-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">Provider:</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs">{provider.name}</span>
          <span className="font-medium text-slate-700">Model:</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs">{provider.model}</span>
          <Badge label={provider.configured ? 'ACTIVE' : 'NOT IMPLEMENTED'} />
          {!provider.configured ? (
            <span className="text-xs text-slate-400">Set NVIDIA_API_KEY and NVIDIA_MODEL (server-side only) to enable generation.</span>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {AGENT_REGISTRY.map((agent) => (
          <div key={agent.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold capitalize text-slate-900">{agent.name.replaceAll('_', ' ')}</h2>
              <Badge label={agent.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{agent.description}</p>
            {!implemented.includes(agent) ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Not Implemented</p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
