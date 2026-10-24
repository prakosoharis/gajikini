'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Overview } from '@/lib/types';
import { Badge, Btn, Card, Th, fmt } from '@/components/ui';

export default function DisbursementsPage() {
  const [rows, setRows] = useState<Overview['disbursements']>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Overview>('/internal/overview')
      .then((o) => {
        setRows(o.disbursements);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function retry(id: string) {
    try {
      await api(`/internal/disbursements/${id}/retry`, { method: 'POST' });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Monitor Disbursement</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card title="Mock payment gateway · auto-refresh 3 detik">
        {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada disbursement.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <Th>Karyawan</Th>
                <Th>Nominal cair</Th>
                <Th>Rekening</Th>
                <Th>Status</Th>
                <Th>Attempt</Th>
                <Th>Ref / Error</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-semibold">{d.withdrawal.employee.name}</td>
                  <td className="py-3 pr-4">{fmt(d.withdrawal.received)}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {d.withdrawal.employee.bankName} {d.withdrawal.employee.bankAccount}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge status={d.status} />
                  </td>
                  <td className="py-3 pr-4">{d.attempts}</td>
                  <td className="max-w-[220px] py-3 pr-4 text-xs text-slate-500">{d.ref || d.lastError || '—'}</td>
                  <td className="py-3">
                    {d.status === 'FAILED' && (
                      <Btn small variant="ghost" onClick={() => retry(d.id)}>
                        Retry
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
