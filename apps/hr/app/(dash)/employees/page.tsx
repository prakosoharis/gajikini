'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { EmployeeRow } from '@/lib/types';
import { Badge, Btn, Card, Field, Input, Modal, Select, Th, fmt } from '@/components/ui';

const EMPTY = { nik: '', name: '', phone: '', baseSalary: '', bankName: '', bankAccount: '', status: 'AKTIF' };

const CSV_TEMPLATE = 'nik;nama;no_hp;gaji_pokok;bank;no_rekening\n3273011234567890;Budi Contoh;081234567890;3200000;BCA;5512345678\n';

interface BulkResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
  const [csvResult, setCsvResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<EmployeeRow[]>('/hr/employees')
      .then((r) => {
        setRows(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.nik.includes(query),
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setOpen(true);
  }

  function openEdit(r: EmployeeRow) {
    setEditing(r);
    setForm({
      nik: r.nik,
      name: r.name,
      phone: r.phone,
      baseSalary: String(r.baseSalary),
      bankName: r.bankName,
      bankAccount: r.bankAccount,
      status: r.status,
    });
    setFormError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      nik: form.nik,
      name: form.name,
      phone: form.phone,
      baseSalary: Number(form.baseSalary),
      bankName: form.bankName,
      bankAccount: form.bankAccount,
      ...(editing ? { status: form.status } : {}),
    };
    try {
      if (editing) {
        await api(`/hr/employees/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/hr/employees', { method: 'POST', body: JSON.stringify(payload) });
      }
      setOpen(false);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(r: EmployeeRow) {
    if (!confirm(`Nonaktifkan ${r.name}? (resign/PHK — tidak bisa lagi menarik gaji)`)) return;
    try {
      await api(`/hr/employees/${r.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // ---------- CSV ----------

  function parseCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const sep = (lines[0] || '').includes(';') ? ';' : ',';
    const out: Array<Record<string, string>> = [];
    for (const line of lines) {
      const cols = line.split(sep).map((c) => c.trim());
      if (/nik/i.test(cols[0]) && /nama|name/i.test(cols[1] || '')) continue; // lewati header
      if (cols.length < 6) continue;
      out.push({ nik: cols[0], name: cols[1], phone: cols[2], baseSalary: cols[3], bankName: cols[4], bankAccount: cols[5] });
    }
    setCsvRows(out);
    setCsvResult(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => parseCsv(String(reader.result || ''));
    reader.readAsText(f);
  }

  async function submitCsv() {
    setBusy(true);
    try {
      const res = await api<BulkResult>('/hr/employees/bulk', {
        method: 'POST',
        body: JSON.stringify({ rows: csvRows.map((r) => ({ ...r, baseSalary: Number(r.baseSalary) })) }),
      });
      setCsvResult(res);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(CSV_TEMPLATE);
    a.download = 'template-karyawan.csv';
    a.click();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Karyawan</h1>
        <div className="flex gap-2">
          <Btn
            variant="ghost"
            onClick={() => {
              setCsvRows([]);
              setCsvResult(null);
              setCsvOpen(true);
            }}
          >
            ⇪ Upload CSV
          </Btn>
          <Btn onClick={openCreate}>+ Tambah Karyawan</Btn>
        </div>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        <Input placeholder="Cari nama atau NIK…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-4 max-w-xs" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <Th>Nama</Th>
                <Th>NIK</Th>
                <Th>Gaji pokok</Th>
                <Th>Upah terakru</Th>
                <Th>Ditarik siklus ini</Th>
                <Th>Rekening</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2.5 pr-4 font-semibold">{r.name}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{r.nik}</td>
                  <td className="py-2.5 pr-4">{fmt(r.baseSalary)}</td>
                  <td className="py-2.5 pr-4">{r.status === 'AKTIF' ? fmt(r.accrued) : '—'}</td>
                  <td className="py-2.5 pr-4">{r.withdrawnThisCycle ? fmt(r.withdrawnThisCycle) : '—'}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">
                    {r.bankName} {r.bankAccount}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge status={r.status} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-2">
                      <Btn small variant="ghost" onClick={() => openEdit(r)}>
                        Edit
                      </Btn>
                      {r.status === 'AKTIF' && (
                        <Btn small variant="danger" onClick={() => deactivate(r)}>
                          Nonaktifkan
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Tidak ada karyawan yang cocok.</p>}
        </div>
      </Card>

      {/* Modal tambah/edit */}
      <Modal title={editing ? `Edit ${editing.name}` : 'Tambah Karyawan'} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="NIK (16 digit)">
              <Input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} required maxLength={16} />
            </Field>
            <Field label="Nama lengkap">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="No. HP (08xx)">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Field>
            <Field label="Gaji pokok (Rp)">
              <Input type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank">
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
            </Field>
            <Field label="No. rekening">
              <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} required />
            </Field>
          </div>
          {editing && (
            <Field label="Status kepegawaian">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="AKTIF">AKTIF</option>
                <option value="NONAKTIF">NONAKTIF (resign/PHK)</option>
              </Select>
            </Field>
          )}

          {formError && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Btn>
            <Btn type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Modal upload CSV */}
      <Modal title="Upload Karyawan Massal (CSV)" open={csvOpen} onClose={() => setCsvOpen(false)}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Format kolom: <code className="rounded bg-slate-100 px-1">nik;nama;no_hp;gaji_pokok;bank;no_rekening</code> (pemisah ; atau
            ,). Baris pertama boleh header.{' '}
            <button onClick={downloadTemplate} className="font-semibold text-indigo-600 hover:underline">
              Unduh template
            </button>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700"
          />
          <textarea
            placeholder="…atau tempel isi CSV di sini"
            onChange={(e) => parseCsv(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />

          {csvRows.length > 0 && !csvResult && (
            <p className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {csvRows.length} baris terbaca dan siap diunggah.
            </p>
          )}

          {csvResult && (
            <div className="space-y-2">
              <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                ✓ {csvResult.created} karyawan berhasil dibuat{csvResult.errors.length > 0 && `, ${csvResult.errors.length} baris gagal:`}
              </p>
              {csvResult.errors.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-auto">
                  {csvResult.errors.map((er) => (
                    <p key={er.row} className="text-xs text-rose-600">
                      Baris {er.row}: {er.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCsvOpen(false)}>
              {csvResult ? 'Tutup' : 'Batal'}
            </Btn>
            {!csvResult && (
              <Btn onClick={submitCsv} disabled={busy || csvRows.length === 0}>
                {busy ? 'Mengunggah…' : `Unggah ${csvRows.length} baris`}
              </Btn>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
