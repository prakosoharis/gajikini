'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InternalUser } from '@/lib/types';
import { Badge, Btn, Card, Field, Input, Modal, Select, Th } from '@/components/ui';

const EMPTY = { name: '', email: '', password: '', role: 'RISK' };

export default function UsersPage() {
  const [rows, setRows] = useState<InternalUser[]>([]);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InternalUser | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api<InternalUser[]>('/internal/users')
      .then((r) => {
        setRows(r);
        setError('');
        setForbidden(false);
      })
      .catch((e) => {
        const msg = (e as Error).message;
        if (msg.includes('Butuh peran')) setForbidden(true);
        else setError(msg);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setOpen(true);
  }

  function openEdit(u: InternalUser) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setFormError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (editing) {
        await api(`/internal/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      } else {
        await api('/internal/users', { method: 'POST', body: JSON.stringify(form) });
      }
      setOpen(false);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: InternalUser) {
    if (!confirm(`Hapus user ${u.name}?`)) return;
    try {
      await api(`/internal/users/${u.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">User Internal</h1>
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">Manajemen user hanya untuk peran ADMIN.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">User Internal</h1>
        <Btn onClick={openCreate}>+ Tambah User</Btn>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 ring-1 ring-rose-200">{error}</p>}

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="py-3 pr-4 font-semibold">{u.name}</td>
                <td className="py-3 pr-4 text-slate-500">{u.email}</td>
                <td className="py-3 pr-4">
                  <Badge status={u.role} />
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Btn small variant="ghost" onClick={() => openEdit(u)}>
                      Edit
                    </Btn>
                    <Btn small variant="danger" onClick={() => remove(u)}>
                      Hapus
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal title={editing ? `Edit ${editing.name}` : 'Tambah User Internal'} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nama">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={Boolean(editing)}
              required={!editing}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={editing ? 'Password baru (kosongkan jika tetap)' : 'Password (min. 8 karakter)'}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={form.password || !editing ? 8 : undefined}
                required={!editing}
              />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="RISK">RISK — risk analyst</option>
                <option value="OPS">OPS — operations</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </Field>
          </div>

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
    </div>
  );
}
