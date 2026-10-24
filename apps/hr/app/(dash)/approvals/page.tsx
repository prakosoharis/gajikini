'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { HrOverview } from '@/lib/types';
import { Btn, Card, fmt, fmtDateTime } from '@/components/ui';

export default function ApprovalsPage() {
  const [pending, setPending] = useState<HrOverview['pending']>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<HrOverview>('/hr/overview')
      .then((o) => {
        setPending(o.pending);
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
    const reason = approve ? undefined : prompt('Alasan penolakan:') || 'Ditolak oleh HR';
    try {
      await api(`/hr/withdrawals/${id}/decision`, { method: 'POST', body: JSON.stringify({ approve, reason }) });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Approval Pertama (HR)</h1>
        <p className="mt-1 text-xs text-slate-400">
          Persetujuan Anda memastikan request berasal dari karyawan aktif dengan data yang benar. Setelah disetujui, request masih melewati
          risk analyst GajiKini sebelum dana cair.
        </p>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        {pending.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Tidak ada antrian. 🎉</p>}
        <div className="divide-y divide-slate-100">
          {pending.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-bold">{w.employee.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  NIK {w.employee.nik} · gaji {fmt(w.employee.baseSalary)} · {fmtDateTime(w.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-extrabold">{fmt(w.amount)}</span>
                <div className="flex gap-2">
                  <Btn small variant="success" onClick={() => decide(w.id, true)}>
                    Setujui
                  </Btn>
                  <Btn small variant="danger" onClick={() => decide(w.id, false)}>
                    Tolak
                  </Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
