'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { section: 'Overview', items: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/ai', label: 'AI Command Center' },
  ]},
  { section: 'CRM', items: [
    { href: '/leads', label: 'Leads' },
    { href: '/companies', label: 'Companies' },
    { href: '/contacts', label: 'Contacts' },
    { href: '/customers', label: 'Customers' },
    { href: '/opportunities', label: 'Opportunities' },
  ]},
  { section: 'Work', items: [
    { href: '/followups', label: 'Follow-ups' },
    { href: '/tasks', label: 'Tasks' },
    { href: '/emails', label: 'Emails' },
    { href: '/proposals', label: 'Proposals' },
    { href: '/approvals', label: 'Approvals' },
  ]},
  { section: 'Intelligence', items: [
    { href: '/agents', label: 'Agents' },
    { href: '/knowledge', label: 'Knowledge' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/settings', label: 'Settings' },
  ]},
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{group.section}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-brand-600/90 font-medium text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
