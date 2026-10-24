import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000';

/** BFF proxy: semua panggilan klien ke /api/be/* diteruskan ke API NestJS dengan Bearer dari cookie httpOnly. */
async function forward(req: NextRequest, params: { path: string[] }) {
  const token = cookies().get('gk_hr_session')?.value;
  const url = `${API_URL}/${params.path.join('/')}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));

  // Sesi habis → bersihkan cookie supaya middleware mengarahkan ke /login.
  if (res.status === 401) {
    const out = NextResponse.json(body, { status: 401 });
    out.cookies.delete('gk_hr_session');
    return out;
  }
  return NextResponse.json(body, { status: res.status });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params);
}
