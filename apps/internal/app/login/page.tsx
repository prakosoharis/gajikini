'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Btn, Field, Input, Logo } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-slate-50 to-white" />
        <div className="absolute -top-32 left-1/2 h-96 w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-300/40 to-violet-300/40 blur-3xl" />
      </div>

      <div className="animate-rise w-full max-w-sm rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-950/5 backdrop-blur-xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-lg font-extrabold tracking-tight">Dashboard Risk & Ops</h1>
        <p className="mb-6 mt-1 text-center text-xs text-slate-400">Masuk dengan akun internal Anda</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gajikini.id"
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>

          {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="brand-gradient w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-slate-400">Akun demo ada di README proyek (bagian Aplikasi Internal).</p>
      </div>
    </main>
  );
}
