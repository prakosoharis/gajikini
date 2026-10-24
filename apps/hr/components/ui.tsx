'use client';

import { STATUS_LABELS, formatIDR } from '@ewa/shared';

export const fmt = formatIDR;

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  AKTIF: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  SUSPEND: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  NONAKTIF: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  ADMIN: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  RISK: { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  OPS: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

const EXTRA_LABELS: Record<string, string> = {
  PENDING: 'Diproses',
  SUCCESS: 'Sukses',
  FAILED: 'Gagal',
  BELUM_DIBAYAR: 'Belum dibayar',
  DIBAYAR: 'Dibayar',
  AKTIF: 'Aktif',
  SUSPEND: 'Suspend',
  NONAKTIF: 'Nonaktif',
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

export function Card({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`animate-rise rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-sm font-bold tracking-tight text-slate-800">{title}</h3>}
          {action}
        </div>
      )}
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
  type = 'button',
  variant = 'primary',
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
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
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-xl font-semibold transition active:scale-[0.98] ${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${props.className || ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${props.className || ''}`}
    />
  );
}

export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-rise w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="py-2.5 pr-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-md shadow-indigo-500/30">
        G
      </span>
      <span className="text-base font-extrabold tracking-tight text-slate-900">
        Gaji<span className="brand-text">Kini</span>
        <span className="ml-1.5 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">HR</span>
      </span>
    </span>
  );
}
