'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { HrOverview } from '@/lib/types';
import { Badge, Card, Stat, UtilBar, fmt, fmtDate } from '@/components/ui';

export default function DashboardPage() {
  const [ov, setOv] = useState<HrOverview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<HrOverview>('/hr/overview')
      .then((o) => {
        setOv(o);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">{ov?.employer.name ?? 'Ringkasan'}</h1>
        {ov && <Badge status={ov.employer.status} />}
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      {ov && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Penarikan siklus ini" value={fmt(ov.stats.cycleWithdrawn)} sub={`${ov.stats.cycleTransactions} transaksi cair`} accent />
            <Stat label="Karyawan aktif" value={String(ov.stats.totalEmployees)} />
            <Stat label="Outstanding" value={fmt(ov.stats.outstanding)} sub="belum dilunasi" />
            <Stat label="Antrian approval" value={String(ov.pending.length)} sub="menunggu HR" />
          </div>

          <Card title={`Utilisasi fasilitas EWA (limit ${fmt(ov.employer.facilityLimit)})`}>
            <UtilBar value={ov.stats.utilization} />
            <p className="mt-2 text-xs text-slate-500">
              {Math.round(ov.stats.utilization * 100)}% terpakai · fee {(ov.employer.feeRateBps / 100).toFixed(2)}% per transaksi
              (ditanggung karyawan)
            </p>
          </Card>

          <Card title="Siklus payroll berjalan">
            <p className="text-sm">
              {fmtDate(ov.cycle.startDate)} – {fmtDate(ov.cycle.endDate)} · payday <b>{fmtDate(ov.cycle.payday)}</b>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hari kerja berjalan: {ov.cycle.workdaysElapsed}/{ov.cycle.totalWorkdays}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
