'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { feeBreakdown, MIN_WITHDRAWAL } from '@ewa/shared';
import { api, clearUser, getUser } from '@/lib/api';
import { Badge, fmt, fmtDate, fmtDateTime } from '@/components/ui';

interface Summary {
  employee: { name: string; baseSalary: number; bankName: string; bankAccount: string; kycStatus: string };
  employer: { name: string; feeRateBps: number };
  cycle: { startDate: string; endDate: string; payday: string; totalWorkdays: number; workdaysElapsed: number };
  accrued: number;
  activeWithdrawn: number;
  limit: number;
  minWithdrawal: number;
  hasPending: boolean;
  withdrawals: Array<{
    id: string;
    amount: number;
    received: number;
    status: string;
    rejectReason?: string;
    createdAt: string;
    disbursement?: { status: string; ref?: string } | null;
  }>;
}

export default function KaryawanPage() {
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api<Summary>('/employee/summary')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'EMPLOYEE') {
      router.replace('/');
      return;
    }
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load, router]);

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    try {
      await api('/employee/withdrawals', { method: 'POST', body: JSON.stringify({ amount }) });
      setSheetOpen(false);
      setAmount(0);
      setNotice('Request terkirim — menunggu persetujuan HR.');
      setTimeout(() => setNotice(''), 5000);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const fees = data && amount >= MIN_WITHDRAWAL ? feeBreakdown(amount, data.employer.feeRateBps) : null;
  const accrualPct = data ? Math.round((data.cycle.workdaysElapsed / data.cycle.totalWorkdays) * 100) : 0;
  const clock = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-hidden py-8">
      {/* Latar dekoratif */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-100 via-slate-100 to-slate-50" />
        <div className="absolute -top-28 left-1/2 h-96 w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-300/40 to-violet-300/40 blur-3xl" />
      </div>

      {/* Frame HP */}
      <div className="relative flex min-h-[760px] w-[395px] flex-col overflow-hidden rounded-[2.6rem] bg-slate-50 shadow-2xl shadow-indigo-950/30 ring-8 ring-slate-900">
        {/* Status bar + notch */}
        <div className="brand-gradient relative px-6 pb-14 pt-3 text-white">
          <div className="absolute left-1/2 top-2 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
            <span>{clock}</span>
            <span className="flex items-center gap-1">
              <svg width="14" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M1 8.5h2.5V11H1zM5 6h2.5v5H5zM9 3.5h2.5V11H9zM13 1h2.5v10H13z"/></svg>
              <svg width="18" height="11" viewBox="0 0 22 12" fill="none" stroke="currentColor"><rect x="1" y="1.5" width="17" height="9" rx="2.5"/><path d="M20 4.5v3" strokeLinecap="round"/><rect x="3" y="3.5" width="11" height="5" rx="1" fill="currentColor" stroke="none"/></svg>
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-white/60">Selamat datang kembali</p>
              <p className="text-lg font-extrabold tracking-tight">{data?.employee.name ?? '…'}</p>
              <p className="text-[11px] text-white/60">{data?.employer.name}</p>
            </div>
            <button
              onClick={() => {
                clearUser();
                router.push('/');
              }}
              className="rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-semibold backdrop-blur transition hover:bg-white/25"
            >
              Keluar
            </button>
          </div>
          {/* lingkaran dekoratif */}
          <div className="pointer-events-none absolute -right-10 -top-6 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -right-2 top-16 h-16 w-16 rounded-full bg-white/10" />
        </div>

        {/* Kartu limit */}
        <div className="-mt-9 px-5">
          <div className="animate-rise rounded-3xl border border-white/60 bg-white/90 p-5 shadow-xl shadow-indigo-950/10 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Limit tersedia</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 3l8 4v5c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V7l8-4z"/></svg>
                KYC {data?.employee.kycStatus.toLowerCase() ?? ''}
              </span>
            </div>
            <p className="brand-text mt-1 text-[2.1rem] font-extrabold leading-tight tracking-tight">
              {data ? fmt(data.limit) : '…'}
            </p>
            {data && (
              <>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="brand-gradient h-full rounded-full transition-all duration-700"
                    style={{ width: `${accrualPct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Upah terakru <b className="text-slate-700">{fmt(data.accrued)}</b> · {data.cycle.workdaysElapsed}/
                  {data.cycle.totalWorkdays} hari kerja
                </p>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>Gajian {fmtDate(data.cycle.payday)}</span>
                  <span>
                    {data.employee.bankName} ···{data.employee.bankAccount.slice(-4)}
                  </span>
                </div>
              </>
            )}
            <button
              onClick={() => setSheetOpen(true)}
              disabled={!data || data.hasPending || data.limit < MIN_WITHDRAWAL}
              className="brand-gradient mt-4 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              {data?.hasPending ? 'Request sedang diproses…' : 'Tarik Gaji Sekarang'}
            </button>
            {data && !data.hasPending && data.limit < MIN_WITHDRAWAL && (
              <p className="mt-2 text-center text-[11px] text-slate-400">Limit belum mencukupi (min. {fmt(MIN_WITHDRAWAL)})</p>
            )}
          </div>
        </div>

        {notice && (
          <p className="animate-rise mx-5 mt-3 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            ✓ {notice}
          </p>
        )}
        {error && (
          <p className="mx-5 mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">{error}</p>
        )}

        {/* Riwayat */}
        <div className="mt-5 flex-1 overflow-y-auto px-5 pb-8">
          <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-800">Riwayat Transaksi</h2>
          <div className="space-y-2.5">
            {data?.withdrawals.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                Belum ada transaksi.
              </p>
            )}
            {data?.withdrawals.map((w) => (
              <div key={w.id} className="animate-rise rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold tracking-tight">{fmt(w.amount)}</span>
                  <Badge status={w.status} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                  <span>
                    Diterima <b className="text-slate-600">{fmt(w.received)}</b>
                  </span>
                  <span>{fmtDateTime(w.createdAt)}</span>
                </div>
                {w.rejectReason && <p className="mt-1.5 text-[11px] font-medium text-rose-500">Alasan: {w.rejectReason}</p>}
                {w.disbursement?.ref && <p className="mt-1.5 font-mono text-[10px] text-slate-300">{w.disbursement.ref}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom sheet request */}
        {sheetOpen && data && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end bg-slate-950/50 backdrop-blur-sm" onClick={() => setSheetOpen(false)}>
            <div className="animate-rise rounded-t-[2rem] bg-white p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
              <h3 className="text-lg font-extrabold tracking-tight">Tarik Gaji</h3>
              <p className="mt-0.5 text-xs text-slate-400">Limit tersedia {fmt(data.limit)}</p>

              <div className="relative mt-4">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder={MIN_WITHDRAWAL.toLocaleString('id-ID')}
                  className="w-full rounded-2xl border-2 border-slate-200 py-3.5 pl-11 pr-4 text-xl font-extrabold tracking-tight transition focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="mt-2.5 flex gap-2">
                {[200_000, 500_000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(Math.min(v, data.limit))}
                    className="flex-1 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                  >
                    {fmt(v)}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(data.limit)}
                  className="flex-1 rounded-xl bg-indigo-50 py-2 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-100"
                >
                  Maks
                </button>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nominal penarikan</span>
                  <span className="font-semibold">{amount ? fmt(amount) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform fee ({(data.employer.feeRateBps / 100).toFixed(2)}%)</span>
                  <span className="font-semibold">{fees ? `− ${fmt(fees.platformFee)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Biaya transfer</span>
                  <span className="font-semibold">{fees ? `− ${fmt(fees.transferFee)}` : '—'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold">Kamu terima</span>
                  <span className="brand-text text-sm font-extrabold">{fees ? fmt(fees.received) : '—'}</span>
                </div>
                <p className="pt-1 text-[10px] leading-relaxed text-slate-400">
                  Tanpa bunga & tanpa denda. Dipotong otomatis dari gaji pada {fmtDate(data.cycle.payday)}.
                </p>
              </div>

              <button
                onClick={submit}
                disabled={submitting || !amount || amount < MIN_WITHDRAWAL || amount > data.limit}
                className="brand-gradient mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {submitting ? 'Mengirim…' : 'Konfirmasi & Kirim Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
