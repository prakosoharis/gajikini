import { NextRequest, NextResponse } from 'next/server';

/** Proteksi rute: tanpa cookie sesi → /login; sudah login → /login dialihkan ke dashboard. */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get('gk_session')?.value);
  const isLogin = req.nextUrl.pathname === '/login';

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
