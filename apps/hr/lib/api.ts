'use client';

export interface SessionUser {
  id: string;
  name: string;
  role: 'RISK' | 'OPS' | 'ADMIN';
  email: string | null;
}

/** Panggil API lewat BFF proxy (/api/be/*). Token tersimpan di cookie httpOnly — tak pernah di JS. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/be${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login';
    throw new Error('Sesi berakhir');
  }
  if (!res.ok) {
    const msg = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || 'Login gagal');
  return body.user as SessionUser;
}

export async function logout() {
  await fetch('/api/session', { method: 'DELETE' });
  window.location.href = '/login';
}
