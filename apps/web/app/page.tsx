'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setUser, SessionUser } from '@/lib/api';
import { Logo } from '@/components/ui';

interface UserGroups {
  employees: SessionUser[];
}

export default function LoginPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<UserGroups | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<UserGroups>('/meta/users')
      .then(setGroups)
      .catch((e) => setError(e.message));
  }, []);

  function login(u: SessionUser, dest: string) {
    setUser(u);
    router.push(dest);
  }

  const col = (
    title: string,
    desc: string,
    icon: React.ReactNode,
    users: SessionUser[] | undefined,
    dest: string,
  ) => (
    <div className="animate-rise flex-1 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-indigo-950/5 backdrop-blur-xl">
      <div className="brand-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
        {icon}
      </div>
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      <p className="mb-5 mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      <div className="space-y-2">
        {(users || []).map((u) => (
          <button
            key={u.id}
            onClick={() => login(u, dest)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
              {u.name
                .split(' ')
                .slice(0, 2)
                .map((s) => s[0])
                .join('')}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{u.name}</span>
              <span className="block truncate text-[11px] text-slate-400">{u.info}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Latar dekoratif */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-slate-50 to-white" />
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-300/40 to-violet-300/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="mb-10 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight md:text-5xl">
            Gajian kapan pun,
            <br />
            <span className="brand-text">tanpa menunggu tanggal tua.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-500">
            Prototipe Earned Wage Access — pilih persona untuk menjelajah alur end-to-end. Demo, tanpa password.
          </p>
        </div>

        {error && (
          <p className="mx-auto mb-6 max-w-md rounded-2xl bg-rose-50 p-4 text-center text-sm font-medium text-rose-600 ring-1 ring-rose-200">
            API tidak terjangkau: {error}
          </p>
        )}
        {!groups && !error && (
          <p className="text-center text-sm text-slate-400">Memuat daftar user demo…</p>
        )}

        {groups && (
          <div className="flex flex-col gap-5 md:flex-row">
            {col(
              'Karyawan',
              'Aplikasi mobile — cek limit upah terakru & tarik gaji lebih awal.',
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="7" y="2" width="10" height="20" rx="2.5" />
                <path d="M11 18h2" />
              </svg>,
              groups.employees,
              '/karyawan',
            )}
            <div className="animate-rise flex-1 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-indigo-950/5 backdrop-blur-xl">
              <div className="brand-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
                  <circle cx="17.5" cy="9.5" r="2.5" />
                  <path d="M16 14.7c2.6.3 4.7 2 5.5 4.8" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold tracking-tight">HR Employer</h2>
              <p className="mb-5 mt-1 text-xs leading-relaxed text-slate-500">
                Portal HR kini aplikasi terpisah dengan login email + password per perusahaan.
              </p>
              <a
                href={process.env.NEXT_PUBLIC_HR_URL || 'http://localhost:3022'}
                className="brand-gradient block rounded-2xl py-3 text-center text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90"
              >
                Buka Portal HR →
              </a>
            </div>
            <div className="animate-rise flex-1 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-indigo-950/5 backdrop-blur-xl">
              <div className="brand-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 3l8 4v5c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V7l8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold tracking-tight">Internal · Risk & Ops</h2>
              <p className="mb-5 mt-1 text-xs leading-relaxed text-slate-500">
                Dashboard internal kini aplikasi terpisah dengan login email + password.
              </p>
              <a
                href={process.env.NEXT_PUBLIC_OPS_URL || 'http://localhost:3021'}
                className="brand-gradient block rounded-2xl py-3 text-center text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90"
              >
                Buka Aplikasi Internal →
              </a>
            </div>
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-slate-400">
          Dua lapis persetujuan · repayment potong gaji · tanpa bunga — sesuai PRD GajiKini
        </p>
      </div>
    </main>
  );
}
