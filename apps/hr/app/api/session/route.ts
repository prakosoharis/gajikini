import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000';
const COOKIE = 'gk_hr_session';

/** Login: teruskan kredensial ke API, simpan JWT di cookie httpOnly (token tak pernah menyentuh JS klien). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message || 'Login gagal' }, { status: res.status });
  }

  cookies().set(COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return NextResponse.json({ user: data.user });
}

/** Logout: hapus cookie sesi. */
export async function DELETE() {
  cookies().delete(COOKIE);
  return NextResponse.json({ ok: true });
}
