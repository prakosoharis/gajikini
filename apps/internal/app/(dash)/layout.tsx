'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, logout, SessionUser } from '@/lib/api';
import { Logo } from '@/components/ui';

const NAV = [
  { href: '/', label: 'Ringkasan', icon: '▤' },
  { href: '/approvals', label: 'Antrian Risk', icon: '✓' },
  { href: '/disbursements', label: 'Disbursement', icon: '⇄' },
  { href: '/invoices', label: 'Tagihan', icon: '▦' },
  { href: '/employers', label: 'Employer', icon: '▣' },
  { href: '/users', label: 'User Internal', icon: '◉' },
  { href: '/audit', label: 'Audit Log', icon: '≡' },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    api<SessionUser>('/auth/me').then(setUser).catch(() => {});
  }, []);

  const initials = (user?.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200/80 bg-white">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active ? 'brand-gradient text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className="w-4 text-center text-xs">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200/80 p-4">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name ?? '…'}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.role}</p>
            </div>
            <button
              onClick={() => logout()}
              title="Keluar"
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="ml-60 flex-1 px-8 py-7">{children}</main>
    </div>
  );
}
