import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/auth/session';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { LogoutButton } from '@/components/layout/logout-button';
import { Badge } from '@/components/ui/primitives';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">LB</span>
          <span>
            <span className="block text-sm font-semibold text-white">LifeBridge MedTech</span>
            <span className="block text-[11px] text-slate-400">AI Business OS</span>
          </span>
        </Link>
        <SidebarNav />
        <div className="border-t border-slate-800 p-4 text-[11px] text-slate-500">
          AI layer assists employees. Protected actions always require human approval.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <nav className="flex gap-3 overflow-x-auto text-sm lg:hidden">
            {['/dashboard', '/leads', '/ai', '/approvals', '/tasks'].map((href) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
                {href.replace('/', '').replace(/^\w/, (c) => c.toUpperCase()) || 'Home'}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.appUser.name}</p>
              <div className="flex justify-end gap-1">
                {user.roles.map((role) => (
                  <Badge key={role} label={role} />
                ))}
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
