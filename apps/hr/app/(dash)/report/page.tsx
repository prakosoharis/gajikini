'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { HrReport } from '@/lib/types';
import { Btn, Card, Th, fmt, fmtDate } from '@/components/ui';

export default function ReportPage() {
  const [data, setData] = useState<HrReport | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<HrReport>('/hr/report')
      .then((r) => {
        setData(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function closeCycle() {
    if (!confirm('Tutup siklus payroll ini dan terbitkan tagihan repayment? Siklus bulan berikutnya akan dibuka otomatis.')) return;
    try {
      await api('/hr/payday/close', { method: 'POST' });
      alert('Siklus ditutup. Tagihan diterbitkan dan siklus baru dibuka.');
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Laporan Potong Gaji</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      {data && (
        <>
          <Card title={`Siklus ${fmtDate(data.cycle.startDate)} s.d. ${fmtDate(data.cycle.payday)}`}>
            {data.report.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Belum ada penarikan yang dicairkan pada siklus ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>Karyawan</Th>
                      <Th>Gaji pokok</Th>
                      <Th>Total potongan EWA</Th>
                      <Th>Transaksi</Th>
                      <Th>Gaji bersih dibayar</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.report.map((r) => (
                      <tr key={r.nik} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4 font-semibold">{r.name}</td>
                        <td className="py-2.5 pr-4">{fmt(r.baseSalary)}</td>
                        <td className="py-2.5 pr-4 text-rose-600">− {fmt(r.totalDeduction)}</td>
                        <td className="py-2.5 pr-4">{r.count}</td>
                        <td className="py-2.5 pr-4 font-bold">{fmt(r.netSalary)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2.5 pr-4 font-extrabold">Total repayment ke GajiKini</td>
                      <td />
                      <td className="py-2.5 pr-4 font-extrabold text-rose-600">{fmt(data.total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Tutup siklus & terbitkan tagihan</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {data.pendingCount > 0
                    ? `Masih ada ${data.pendingCount} request belum selesai — selesaikan antrian dulu.`
                    : 'Semua request selesai. Siklus siap ditutup; siklus bulan berikutnya dibuka otomatis.'}
                </p>
              </div>
              <Btn onClick={closeCycle} disabled={data.pendingCount > 0}>
                Tutup Siklus Payroll
              </Btn>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
