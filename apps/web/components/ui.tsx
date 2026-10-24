'use client';

import { STATUS_LABELS, formatIDR } from '@ewa/shared';

export const fmt = formatIDR;

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_STYLES: Record<string, { dot: string; chip: string }> = {
  MENUNGGU_HR: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  MENUNGGU_RISK: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  DIPROSES_CAIR: { dot: 'bg-blue-500 animate-pulse', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  DICAIRKAN: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  DILUNASI: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  DITOLAK_HR: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
  DITOLAK_RISK: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
  GAGAL_CAIR: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200' },
  PENDING: { dot: 'bg-blue-500 animate-pulse', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  SUCCESS: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  FAILED: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200' },
  BELUM_DIBAYAR: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DIBAYAR: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

const EXTRA_LABELS: Record<string, string> = {
  PENDING: 'Diproses',
  SUCCESS: 'Sukses',
  FAILED: 'Gagal',
  BELUM_DIBAYAR: 'Belum dibayar',
  DIBAYAR: 'Dibayar',
};

export function Badge({ status }: { status: string }) {
  const label = (STATUS_LABELS as Record<string, string>)[status] || EXTRA_LABELS[status] || status;
  const s = STATUS_STYLES[status] || { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`animate-rise rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}>
      {title && <h3 className="mb-4 text-sm font-bold tracking-tight text-slate-800">{title}</h3>}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`animate-rise rounded-2xl border p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${
        accent ? 'brand-gradient border-transparent text-white' : 'border-slate-200/80 bg-white'
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent ? 'text-white/70' : 'text-slate-400'}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? 'text-white/70' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
}

export function UtilBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.round(value * 100));
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  small?: boolean;
}) {
  const base = small ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
  const styles = {
    primary: 'brand-gradient text-white shadow-md shadow-indigo-500/25 hover:opacity-90 disabled:opacity-40 disabled:shadow-none',
    success: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-500 disabled:opacity-40 disabled:shadow-none',
    danger: 'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40',
    ghost: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40',
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-xl font-semibold transition active:scale-[0.98] ${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-md shadow-indigo-500/30">
        G
      </span>
      <span className={`text-base font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Gaji<span className={light ? 'text-indigo-200' : 'brand-text'}>Kini</span>
      </span>
    </span>
  );
}

export function TopBar({ title, userName, extra }: { title: string; userName: string; extra?: string }) {
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="hidden sm:block">
            <p className="text-sm font-bold leading-tight">{title}</p>
            {extra && <p className="text-[11px] text-slate-400">{extra}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white">
            {initials}
          </div>
          <span className="hidden text-sm font-medium text-slate-600 md:block">{userName}</span>
          <a
            href="/"
            onClick={() => localStorage.removeItem('ewa-user')}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            Keluar
          </a>
        </div>
      </div>
    </header>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            active === t.key ? 'brand-gradient text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && t.count > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                active === t.key ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
}
