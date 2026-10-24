'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Overview } from '@/lib/types';
import { Badge, Btn, Card, fmt, fmtDate } from '@/components/ui';

export default function InvoicesPage() {
  const [rows, setRows] = useState<Overview['invoices']>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Overview>('/internal/overview')
      .then((o) => {
        setRows(o.invoices);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function pay(id: string) {
    if (!confirm('Tandai tagihan ini sudah dibayar employer?')) return;
    try {
      await api(`/internal/invoices/${id}/pay`, { method: 'POST' });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Tagihan Repayment</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada tagihan. Tagihan terbit saat HR menutup siklus payroll.</p>}
        <div className="divide-y divide-slate-100">
          {rows.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-bold">
                  {inv.employer.name} · {fmt(inv.total)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Jatuh tempo {fmtDate(inv.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={inv.status} />
                {inv.status === 'BELUM_DIBAYAR' && (
                  <Btn small variant="success" onClick={() => pay(inv.id)}>
                    Tandai Dibayar
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
