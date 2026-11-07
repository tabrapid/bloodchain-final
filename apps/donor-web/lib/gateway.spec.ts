// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/v1/[...path]/route';
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const request = (
  path: string,
  init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {},
) => new NextRequest(`http://localhost:3005/api/v1/${path}`, init);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('donor same-origin gateway', () => {
  it('sets HttpOnly session cookies and removes both tokens from browser JSON', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: {
            accessToken: 'access-fixture',
            refreshToken: 'refresh-fixture',
            user: { id: 'donor' },
          },
        }),
      ),
    );
    const response = await POST(
      request('auth/login', {
        method: 'POST',
        headers: { origin: 'http://localhost:3005' },
        body: JSON.stringify({ phone: '+998901234567', password: 'fixture' }),
      }),
      context('auth/login'),
    );
    expect(await response.json()).toEqual({ data: { user: { id: 'donor' } } });
    expect(response.cookies.get('bc_donor_access')?.value).toBe('access-fixture');
    expect(response.cookies.get('bc_donor_refresh')?.value).toBe('refresh-fixture');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects cross-origin writes before contacting the API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await POST(
      request('appointments', {
        method: 'POST',
        headers: { origin: 'https://untrusted.test' },
        body: '{}',
      }),
      context('appointments'),
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the cookie session rather than a forged browser bearer token', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: { id: 'me' } }));
    vi.stubGlobal('fetch', fetch);
    await GET(
      request('auth/me', {
        headers: {
          cookie: 'bc_donor_access=cookie-access',
          authorization: 'Bearer forged',
          'user-agent': 'Donor browser fixture',
        },
      }),
      context('auth/me'),
    );
    expect(fetch.mock.calls[0]![1].headers.get('Authorization')).toBe('Bearer cookie-access');
    expect(fetch.mock.calls[0]![1].headers.get('User-Agent')).toBe('Donor browser fixture');
  });
  it('refreshes with the HttpOnly token and rotates cookies without leaking the rotated tokens', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
      );
    vi.stubGlobal('fetch', fetch);
    const response = await POST(
      request('auth/refresh', {
        method: 'POST',
        headers: { origin: 'http://localhost:3005', cookie: 'bc_donor_refresh=old-refresh' },
        body: '{"refreshToken":"forged"}',
      }),
      context('auth/refresh'),
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ refreshToken: 'old-refresh' });
    expect(response.cookies.get('bc_donor_refresh')?.value).toBe('new-refresh');
    expect(await response.json()).toEqual({ data: {} });
  });
  it('clears both cookies when refresh is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ message: 'Expired' }, { status: 401 })),
    );
    const response = await POST(
      request('auth/refresh', { method: 'POST', headers: { origin: 'http://localhost:3005' } }),
      context('auth/refresh'),
    );
    expect(response.status).toBe(401);
    expect(response.cookies.get('bc_donor_access')?.value).toBe('');
    expect(response.cookies.get('bc_donor_refresh')?.value).toBe('');
  });
  it('fails closed on upstream outage and path traversal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect((await GET(request('donors/profile'), context('donors/profile'))).status).toBe(503);
    expect((await GET(request('donors/profile'), context('../private'))).status).toBe(400);
  });
});
