'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, fmtDateTime } from '@/components/ui';

interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  detail?: string;
  createdAt: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<AuditRow[]>('/internal/audit')
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
      <h1 className="text-xl font-extrabold tracking-tight">Audit Log</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card title="50 aktivitas terakhir (append-only)">
        <div className="divide-y divide-slate-100">
          {rows.map((a) => (
            <div key={a.id} className="flex items-baseline gap-2 py-2.5 text-xs">
              <span className="shrink-0 font-bold">{a.actorName}</span>
              <span className="shrink-0 text-slate-400">({a.actorRole})</span>
              <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono font-semibold text-indigo-700">{a.action}</span>
              {a.detail && <span className="min-w-0 flex-1 truncate text-slate-500">{a.detail}</span>}
              <span className="ml-auto shrink-0 text-slate-400">{fmtDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
