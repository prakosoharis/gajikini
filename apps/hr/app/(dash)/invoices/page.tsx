'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InvoiceRow } from '@/lib/types';
import { Badge, Card, fmt, fmtDate } from '@/components/ui';

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<InvoiceRow[]>('/hr/invoices')
      .then((r) => {
        setRows(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Tagihan Repayment</h1>
      <p className="-mt-3 text-xs text-slate-400">
        Tagihan terbit saat siklus ditutup. Transfer total tagihan ke rekening GajiKini sebelum jatuh tempo; status berubah setelah
        dikonfirmasi tim GajiKini.
      </p>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Belum ada tagihan.</p>}
        <div className="divide-y divide-slate-100">
          {rows.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-extrabold">{fmt(inv.total)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Siklus {fmtDate(inv.cycle.startDate)} – {fmtDate(inv.cycle.endDate)} · jatuh tempo {fmtDate(inv.dueDate)}
                </p>
              </div>
              <Badge status={inv.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
