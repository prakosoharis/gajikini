'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Overview } from '@/lib/types';
import { Badge, Card, Stat, UtilBar, fmt } from '@/components/ui';

export default function DashboardPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Overview>('/internal/overview')
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
      <h1 className="text-xl font-extrabold tracking-tight">Ringkasan Portofolio</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      {ov && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total penarikan (TPV)" value={fmt(ov.stats.tpv)} sub={`${ov.stats.transactions} transaksi cair`} accent />
            <Stat label="Pendapatan platform fee" value={fmt(ov.stats.feeRevenue)} />
            <Stat label="Antrian risk" value={String(ov.riskQueue.length)} sub="menunggu approval kedua" />
            <Stat label="Employer" value={String(ov.portfolio.length)} sub={`${ov.portfolio.filter((p) => p.status === 'AKTIF').length} aktif`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {ov.portfolio.map((p) => (
              <Link key={p.id} href={`/employers/${p.id}`} className="block transition hover:-translate-y-0.5">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {p.sector} · {p.employees} karyawan · fee {(p.feeRateBps / 100).toFixed(2)}%
                      </p>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div className="mt-4">
                    <UtilBar value={p.utilization} />
                    <p className="mt-2 text-xs text-slate-500">
                      Outstanding {fmt(p.outstanding)} dari limit {fmt(p.facilityLimit)} ({Math.round(p.utilization * 100)}%)
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
