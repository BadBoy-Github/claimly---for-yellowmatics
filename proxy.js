import { NextResponse } from 'next/server.js';
import { isValidSessionToken, SESSION_COOKIE_NAME } from './src/server/services/auth.js';

const publicPaths = new Set(['/login', '/403', '/api/auth/login', '/api/auth/logout']);

export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = isValidSessionToken(token);

  if (publicPaths.has(pathname)) {
    if (pathname === '/login' && authenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return Response.json(
      { error: 'Sign in to access this resource.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
