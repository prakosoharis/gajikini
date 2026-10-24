'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EmployerRow } from '@/lib/types';
import { Badge, Btn, Card, Field, Input, Modal, Th, UtilBar, fmt } from '@/components/ui';

const EMPTY = { name: '', sector: '', monthlyRevenue: '', facilityLimit: '', feeRateBps: '450' };

export default function EmployersPage() {
  const [rows, setRows] = useState<EmployerRow[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api<EmployerRow[]>('/internal/employers')
      .then((r) => {
        setRows(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api('/internal/employers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          sector: form.sector,
          monthlyRevenue: Number(form.monthlyRevenue),
          facilityLimit: Number(form.facilityLimit),
          feeRateBps: Number(form.feeRateBps),
        }),
      });
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Employer</h1>
        <Btn onClick={() => setOpen(true)}>+ Tambah Employer</Btn>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <Th>Perusahaan</Th>
                <Th>Sektor</Th>
                <Th>Karyawan</Th>
                <Th>Fee</Th>
                <Th>Utilisasi fasilitas</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 transition hover:bg-slate-50/50">
                  <td className="py-3 pr-4">
                    <Link href={`/employers/${e.id}`} className="font-semibold text-indigo-700 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{e.sector}</td>
                  <td className="py-3 pr-4">{e.employees}</td>
                  <td className="py-3 pr-4">{(e.feeRateBps / 100).toFixed(2)}%</td>
                  <td className="py-3 pr-4" style={{ minWidth: 180 }}>
                    <UtilBar value={e.utilization} />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {fmt(e.outstanding)} / {fmt(e.facilityLimit)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal title="Tambah Employer Baru" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Nama perusahaan">
            <Input value={form.name} onChange={set('name')} placeholder="PT Contoh Sejahtera" required />
          </Field>
          <Field label="Sektor">
            <Input value={form.sector} onChange={set('sector')} placeholder="Outsourcing & Alih Daya" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Revenue bulanan (Rp)">
              <Input type="number" value={form.monthlyRevenue} onChange={set('monthlyRevenue')} placeholder="500000000" required />
            </Field>
            <Field label="Limit fasilitas (Rp, maks. 20% revenue)">
              <Input type="number" value={form.facilityLimit} onChange={set('facilityLimit')} placeholder="100000000" required />
            </Field>
          </div>
          <Field label="Fee rate (bps — 450 = 4,5%)">
            <Input type="number" value={form.feeRateBps} onChange={set('feeRateBps')} min={100} max={1000} required />
          </Field>

          {formError && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Btn>
            <Btn type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan & Buka Siklus'}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
