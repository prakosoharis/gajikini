'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Btn, Card, Field, Input, Modal, Select, Stat, Th, UtilBar, fmt, fmtDate, fmtDateTime } from '@/components/ui';

interface Detail {
  id: string;
  name: string;
  sector: string;
  monthlyRevenue: number;
  facilityLimit: number;
  feeRateBps: number;
  status: string;
  outstanding: number;
  utilization: number;
  employees: Array<{ id: string; nik: string; name: string; baseSalary: number; kycStatus: string; status: string }>;
  cycles: Array<{ id: string; startDate: string; endDate: string; payday: string; status: string }>;
  invoices: Array<{ id: string; total: number; dueDate: string; status: string }>;
  recentWithdrawals: Array<{ id: string; amount: number; status: string; createdAt: string; employee: { name: string } }>;
}

export default function EmployerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sector: '', monthlyRevenue: '', facilityLimit: '', feeRateBps: '', status: 'AKTIF' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api<Detail>(`/internal/employers/${id}`)
      .then((r) => {
        setD(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit() {
    if (!d) return;
    setForm({
      name: d.name,
      sector: d.sector,
      monthlyRevenue: String(d.monthlyRevenue),
      facilityLimit: String(d.facilityLimit),
      feeRateBps: String(d.feeRateBps),
      status: d.status,
    });
    setFormError('');
    setEditOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api(`/internal/employers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          sector: form.sector,
          monthlyRevenue: Number(form.monthlyRevenue),
          facilityLimit: Number(form.facilityLimit),
          feeRateBps: Number(form.feeRateBps),
          status: form.status,
        }),
      });
      setEditOpen(false);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!confirm('Nonaktifkan employer ini? Karyawan tidak bisa lagi menarik gaji (riwayat tetap tersimpan).')) return;
    try {
      await api(`/internal/employers/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (error) return <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>;
  if (!d) return <p className="text-sm text-slate-400">Memuat…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/employers" className="text-xs font-semibold text-indigo-600 hover:underline">
            ← Semua employer
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-xl font-extrabold tracking-tight">
            {d.name} <Badge status={d.status} />
          </h1>
          <p className="text-xs text-slate-400">{d.sector}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={openEdit}>
            Edit
          </Btn>
          {d.status !== 'NONAKTIF' && (
            <Btn variant="danger" onClick={deactivate}>
              Nonaktifkan
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue bulanan" value={fmt(d.monthlyRevenue)} />
        <Stat label="Limit fasilitas" value={fmt(d.facilityLimit)} sub={`fee ${(d.feeRateBps / 100).toFixed(2)}%`} />
        <Stat label="Outstanding" value={fmt(d.outstanding)} sub={`${Math.round(d.utilization * 100)}% terpakai`} />
        <Stat label="Karyawan" value={String(d.employees.length)} />
      </div>

      <Card title="Utilisasi fasilitas">
        <UtilBar value={d.utilization} />
      </Card>

      <Card title={`Karyawan (${d.employees.length})`}>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <Th>Nama</Th>
                <Th>NIK</Th>
                <Th>Gaji pokok</Th>
                <Th>KYC</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {d.employees.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="py-2.5 pr-4 font-semibold">{e.name}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{e.nik}</td>
                  <td className="py-2.5 pr-4">{fmt(e.baseSalary)}</td>
                  <td className="py-2.5 pr-4 text-xs text-emerald-600">{e.kycStatus}</td>
                  <td className="py-2.5 pr-4 text-xs">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Penarikan terakhir">
          <div className="divide-y divide-slate-100">
            {d.recentWithdrawals.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Belum ada.</p>}
            {d.recentWithdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-semibold">{w.employee.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{fmtDateTime(w.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{fmt(w.amount)}</span>
                  <Badge status={w.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Tagihan terakhir">
          <div className="divide-y divide-slate-100">
            {d.invoices.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Belum ada.</p>}
            {d.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold">{fmt(inv.total)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">jatuh tempo {fmtDate(inv.dueDate)}</span>
                  <Badge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal title={`Edit ${d.name}`} open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nama perusahaan">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Sektor">
            <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Revenue bulanan (Rp)">
              <Input type="number" value={form.monthlyRevenue} onChange={(e) => setForm({ ...form, monthlyRevenue: e.target.value })} required />
            </Field>
            <Field label="Limit fasilitas (Rp)">
              <Input type="number" value={form.facilityLimit} onChange={(e) => setForm({ ...form, facilityLimit: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fee rate (bps)">
              <Input type="number" value={form.feeRateBps} onChange={(e) => setForm({ ...form, feeRateBps: e.target.value })} min={100} max={1000} required />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="AKTIF">AKTIF</option>
                <option value="SUSPEND">SUSPEND (tangguhkan penarikan)</option>
                <option value="NONAKTIF">NONAKTIF</option>
              </Select>
            </Field>
          </div>

          {formError && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={() => setEditOpen(false)}>
              Batal
            </Btn>
            <Btn type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan Perubahan'}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
