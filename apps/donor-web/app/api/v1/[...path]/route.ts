import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const accessCookie = 'bc_donor_access';
const refreshCookie = 'bc_donor_refresh';
const tokenEndpoints = new Set([
  'auth/login',
  'auth/verify-email',
  'auth/register-phone',
  'auth/refresh',
]);

/** Same-origin gateway. Session tokens stay in HttpOnly cookies, never browser storage or JSON. */
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((part) => ['.', '..'].includes(part) || /[\\/]/.test(part)))
    return NextResponse.json({ message: 'Invalid API path' }, { status: 400 });
  const endpoint = path.join('/');
  const mutating = !['GET', 'HEAD'].includes(request.method);
  const allowedOrigin = process.env.DONOR_ORIGIN ?? request.nextUrl.origin;
  if (mutating && request.headers.get('origin') !== allowedOrigin)
    return NextResponse.json({ message: 'Origin rejected' }, { status: 403 });
  const upstream = new URL(process.env.API_UPSTREAM_URL ?? 'http://127.0.0.1:3001');
  if (!['http:', 'https:'].includes(upstream.protocol))
    return NextResponse.json({ message: 'API configuration error' }, { status: 503 });
  const url = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}`, upstream);
  url.search = request.nextUrl.search;
  const headers = new Headers({ Accept: 'application/json' });
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('User-Agent', userAgent.slice(0, 512));
  const realIp = request.headers.get('x-real-ip');
  if (process.env.DONOR_ORIGIN && realIp && /^[0-9a-fA-F:.]+$/.test(realIp))
    headers.set('X-Forwarded-For', realIp);
  const access = request.cookies.get(accessCookie)?.value;
  if (access) headers.set('Authorization', `Bearer ${access}`);
  let body = mutating ? await request.text() : undefined;
  if (endpoint === 'auth/refresh' || endpoint === 'auth/logout')
    body = JSON.stringify({ refreshToken: request.cookies.get(refreshCookie)?.value ?? '' });
  if (body) headers.set('Content-Type', 'application/json');
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const json = await response.json().catch(() => ({}));
    const tokens = tokenEndpoints.has(endpoint) && response.ok ? { ...json.data } : undefined;
    if (tokens) {
      delete json.data.accessToken;
      delete json.data.refreshToken;
    }
    const out =
      response.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(json, {
            status: response.status >= 300 && response.status < 400 ? 502 : response.status,
          });
    out.headers.set('Cache-Control', 'private, no-store');
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    // Capture token values before sanitizing the JSON response.
    if (tokens?.accessToken)
      out.cookies.set(accessCookie, tokens.accessToken, { ...cookieOptions, maxAge: 86400 });
    if (tokens?.refreshToken)
      out.cookies.set(refreshCookie, tokens.refreshToken, {
        ...cookieOptions,
        path: '/api/v1/auth',
        maxAge: 30 * 86400,
      });
    if (
      endpoint === 'auth/logout' ||
      (endpoint === 'auth/refresh' && !response.ok) ||
      (endpoint === 'users/me' && request.method === 'DELETE' && response.ok)
    ) {
      out.cookies.set(accessCookie, '', { ...cookieOptions, maxAge: 0 });
      out.cookies.set(refreshCookie, '', { ...cookieOptions, path: '/api/v1/auth', maxAge: 0 });
    }
    return out;
  } catch {
    return NextResponse.json({ message: 'API vaqtincha mavjud emas.' }, { status: 503 });
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
