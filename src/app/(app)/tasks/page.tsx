import type { Metadata } from 'next';
import { getSessionUser } from '@/auth/session';
import { taskRepository, userRepository } from '@/repositories/supabase';
import { ConfigurationError } from '@/supabase/server';
import { Badge, EmptyState, NotConfiguredState, PageHeader, Table, formatDate } from '@/components/ui/primitives';
import { TaskCompleteButton, TaskCreateForm } from '@/components/crm/forms';

export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  let tasks, users;
  try {
    await getSessionUser();
    [tasks, users] = await Promise.all([taskRepository.list({ limit: 200 }), userRepository.list(200)]);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return (
        <>
          <PageHeader title="Tasks" />
          <NotConfiguredState />
        </>
      );
    }
    throw error;
  }
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? '—' : 'Unassigned');

  return (
    <>
      <PageHeader title="Tasks" subtitle={`${tasks.length} task(s)`} actions={<TaskCreateForm />} />
      {tasks.length === 0 ? (
        <EmptyState title="No tasks" hint="Tasks are created manually or by automations and agents." />
      ) : (
        <Table head={['Title', 'Priority', 'Status', 'Assignee', 'Due', '']}>
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-slate-50">
              <td className="max-w-md px-4 py-2.5">
                <p className="truncate font-medium text-slate-700">{task.title}</p>
                {task.description ? <p className="truncate text-xs text-slate-400">{task.description}</p> : null}
              </td>
              <td className="px-4 py-2.5">
                <Badge label={task.priority} />
              </td>
              <td className="px-4 py-2.5">
                <Badge label={task.status} />
              </td>
              <td className="px-4 py-2.5 text-slate-500">{userName(task.assigned_to)}</td>
              <td className="px-4 py-2.5 text-slate-500">{formatDate(task.due_date)}</td>
              <td className="px-4 py-2.5">{['todo', 'in_progress'].includes(task.status) ? <TaskCompleteButton taskId={task.id} /> : null}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
