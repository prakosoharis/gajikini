'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Btn, Card, UtilBar, fmt, fmtDateTime } from '@/components/ui';

interface RiskItem {
  id: string;
  amount: number;
  received: number;
  createdAt: string;
  employee: {
    name: string;
    baseSalary: number;
    bankName: string;
    bankAccount: string;
    accrued: number;
    ceiling: number;
    pctOfCeiling: number;
    cycleTxCount: number;
    failCount: number;
    successCount: number;
  };
  employer: {
    id: string;
    name: string;
    status: string;
    facilityLimit: number;
    outstanding: number;
    utilNow: number;
    utilAfter: number;
    overdueCount: number;
    overdueTotal: number;
  };
  flags: Array<{ code: string; label: string; level: 'MERAH' | 'KUNING' | 'INFO' }>;
  recommendation: 'LAYAK' | 'PERIKSA' | 'TAHAN';
}

const REKO_STYLE: Record<string, string> = {
  LAYAK: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PERIKSA: 'bg-amber-50 text-amber-700 ring-amber-200',
  TAHAN: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const FLAG_STYLE: Record<string, string> = {
  MERAH: 'bg-rose-50 text-rose-700 ring-rose-200',
  KUNING: 'bg-amber-50 text-amber-700 ring-amber-200',
  INFO: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function ApprovalsPage() {
  const [queue, setQueue] = useState<RiskItem[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<RiskItem[]>('/internal/risk-queue')
      .then((r) => {
        setQueue(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: string, approve: boolean) {
    const reason = approve ? undefined : prompt('Alasan penolakan:') || 'Ditolak oleh risk analyst';
    try {
      await api(`/internal/withdrawals/${id}/decision`, { method: 'POST', body: JSON.stringify({ approve, reason }) });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Antrian Approval Kedua (Risk)</h1>
        <p className="mt-1 text-xs text-slate-400">
          Rekomendasi otomatis: <b className="text-emerald-600">LAYAK</b> = tanpa bendera ·{' '}
          <b className="text-amber-600">PERIKSA</b> = ada bendera kuning · <b className="text-rose-600">TAHAN</b> = ada bendera merah.
          Keputusan akhir tetap di analis.
        </p>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      {queue.length === 0 && (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">Tidak ada antrian. 🎉</p>
        </Card>
      )}

      {queue.map((w) => (
        <Card key={w.id}>
          {/* Header: siapa, berapa, rekomendasi */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-extrabold tracking-tight">
                {w.employee.name} <span className="text-sm font-semibold text-slate-400">· {w.employer.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {fmtDateTime(w.createdAt)} · cair ke {w.employee.bankName} {w.employee.bankAccount} · diterima {fmt(w.received)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold tracking-tight">{fmt(w.amount)}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${REKO_STYLE[w.recommendation]}`}>
                {w.recommendation}
              </span>
            </div>
          </div>

          {/* Panel konteks: employer | karyawan */}
          <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Kesehatan employer</p>
              <UtilBar value={w.employer.utilAfter} />
              <p className="mt-2 text-xs text-slate-600">
                Utilisasi fasilitas {Math.round(w.employer.utilNow * 100)}% →{' '}
                <b>{Math.round(w.employer.utilAfter * 100)}% jika disetujui</b> ({fmt(w.employer.outstanding)} /{' '}
                {fmt(w.employer.facilityLimit)})
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Tagihan telat:{' '}
                {w.employer.overdueCount > 0 ? (
                  <b className="text-rose-600">
                    {w.employer.overdueCount} tagihan · {fmt(w.employer.overdueTotal)}
                  </b>
                ) : (
                  <b className="text-emerald-600">tidak ada</b>
                )}{' '}
                · status: {w.employer.status}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Profil karyawan</p>
              <UtilBar value={w.employee.pctOfCeiling} />
              <p className="mt-2 text-xs text-slate-600">
                Nominal = <b>{Math.round(w.employee.pctOfCeiling * 100)}% dari limit karyawan</b> ({fmt(w.employee.ceiling)}, dari upah
                terakru {fmt(w.employee.accrued)} · gaji {fmt(w.employee.baseSalary)})
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Tarikan ke-{w.employee.cycleTxCount} siklus ini · riwayat sukses {w.employee.successCount}x · gagal{' '}
                {w.employee.failCount}x
              </p>
            </div>
          </div>

          {/* Bendera */}
          {w.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {w.flags.map((f) => (
                <span key={f.code} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${FLAG_STYLE[f.level]}`}>
                  {f.level === 'MERAH' ? '⛔' : f.level === 'KUNING' ? '⚠' : 'ℹ'} {f.label}
                </span>
              ))}
            </div>
          )}

          {/* Aksi */}
          <div className="mt-4 flex justify-end gap-2">
            <Btn small variant="danger" onClick={() => decide(w.id, false)}>
              Tolak
            </Btn>
            <Btn small variant="success" onClick={() => decide(w.id, true)}>
              Setujui & Cairkan
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}
