import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { automationRunRepository, userRepository } from '@/repositories/supabase';
import { ConfigurationError, isAiConfigured, isDatabaseConfigured, isEmailConfigured } from '@/supabase/server';
import { Badge, Card, NotConfiguredState, PageHeader, Table, formatDate } from '@/components/ui/primitives';
import { ROLE_PERMISSIONS, PERMISSIONS } from '@/auth/permissions';
import { AGENT_REGISTRY } from '@/ai/manager';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let users, automations;
  try {
    const user = await getSessionUser();
    if (!user) throw new ConfigurationError('Session required');
    [users, automations] = await Promise.all([userRepository.list(200), automationRunRepository.listRecent(10)]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Settings" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }

  const integrations = [
    { name: 'Supabase PostgreSQL', configured: isDatabaseConfigured() },
    { name: 'NVIDIA AI', configured: isAiConfigured() },
    { name: 'Hostinger SMTP', configured: isEmailConfigured() },
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Status and role configuration — secret values are never displayed" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Integration status">
          <ul className="space-y-2 text-sm">
            {integrations.map((integration) => (
              <li key={integration.name} className="flex items-center justify-between gap-2">
                <span className="text-slate-700">{integration.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${integration.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {integration.configured ? 'Configured' : 'Not Configured'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Credentials live only in server-side environment variables. This page shows status only.
          </p>
        </Card>

        <Card title="Email & approvals policy">
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• Email mode: <strong>DRAFT_ONLY</strong> — AI may draft; external sending is not implemented.</li>
            <li>• Approval-required actions: outbound sales email, WhatsApp message, quotation, proposal, website publish, pricing change, customer commitment.</li>
            <li>• Automations perform internal actions only (tasks, drafts, alerts, record updates).</li>
          </ul>
        </Card>

        <Card title="Roles & permissions" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-slate-500">Role</th>
                  {PERMISSIONS.map((permission) => (
                    <th key={permission} className="px-1.5 py-1 text-left font-medium text-slate-400">
                      {permission}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => (
                  <tr key={role}>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{role}</td>
                    {PERMISSIONS.map((permission) => (
                      <td key={permission} className="px-1.5 py-1.5">
                        {permissions.includes(permission) ? (
                          <span className="text-emerald-600" aria-label="granted">✓</span>
                        ) : (
                          <span className="text-slate-300" aria-label="denied">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Team (${users.length})`} className="lg:col-span-2">
          <Table head={['Name', 'Email', 'Status', 'Joined']}>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-slate-700">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">
                  <Badge label={u.status === 'active' ? 'active' : 'cancelled'} />
                </td>
                <td className="px-4 py-2 text-slate-400">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-slate-400">
            Provision users by inserting a `users` row linked to the Supabase Auth user id, then assign roles.
          </p>
        </Card>

        <Card title="Recent automation runs" className="lg:col-span-2">
          {automations.length === 0 ? (
            <p className="text-sm text-slate-500">No automation runs yet. Cron jobs appear here (lead qualification, overdue follow-ups, daily report…).</p>
          ) : (
            <Table head={['Automation', 'Status', 'Started', 'Completed']}>
              {automations.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-2 font-medium text-slate-700">{run.automation.replaceAll('-', ' ')}</td>
                  <td className="px-4 py-2">
                    <Badge label={run.status === 'success' ? 'approved' : run.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(run.started_at)}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(run.completed_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Agent registry" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {AGENT_REGISTRY.map((agent) => (
              <span key={agent.name} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1">
                <span className="font-medium capitalize text-slate-600">{agent.name.replaceAll('_', ' ')}</span>
                <Badge label={agent.status} />
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
