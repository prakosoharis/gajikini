// Tanpa NEXT_PUBLIC_API_URL (deploy Vercel), API dipanggil same-origin di /api (route handlers).
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface SessionUser {
  id: string;
  name: string;
  role: 'EMPLOYEE' | 'HR' | 'RISK' | 'OPS';
  info?: string;
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ewa-user');
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setUser(u: SessionUser) {
  localStorage.setItem('ewa-user', JSON.stringify(u));
}

export function clearUser() {
  localStorage.removeItem('ewa-user');
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const user = getUser();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'x-user-id': user.id } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `HTTP ${res.status}`);
  }
  return body as T;
}
