import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiRequest } from './client';

/**
 * P3-2 (second installment): the first tests admin-web has ever had.
 *
 * admin-web's client already refreshed and retried (unlike the two dashboard
 * apps, whose per-module copies did not — see their own api-client.spec.ts), so
 * these tests pin that behaviour rather than introduce it, and document the
 * places where this client deliberately differs: its own storage keys, and a
 * Content-Type header set only for string bodies.
 */

const ACCESS = 'admin_access_token';
const REFRESH = 'admin_refresh_token';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('admin apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the { data } envelope', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: 'user-1' } }));

    expect(await apiRequest<{ id: string }>('/admin/users/user-1')).toEqual({ id: 'user-1' });
  });

  it('sends no Authorization header when signed out, rather than inventing one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await apiRequest('/admin/users');

    const headers = fetchMock.mock.calls[0]![1].headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('sets Content-Type only for a string body', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValue(jsonResponse(200, { data: null }));

    await apiRequest('/admin/users/1/suspend', { method: 'POST', body: '{"reason":"x"}' });
    expect((fetchMock.mock.calls[0]![1].headers as Headers).get('Content-Type')).toBe(
      'application/json',
    );

    await apiRequest('/admin/users/1/restore', { method: 'POST' });
    expect((fetchMock.mock.calls[1]![1].headers as Headers).has('Content-Type')).toBe(false);
  });

  it('refreshes and retries once when the access token has expired', async () => {
    localStorage.setItem(ACCESS, 'expired');
    localStorage.setItem(REFRESH, 'refresh-1');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'user-1' } }));

    expect(await apiRequest<{ id: string }>('/admin/users/user-1')).toEqual({ id: 'user-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(ACCESS)).toBe('access-2');
    expect((fetchMock.mock.calls[2]![1].headers as Headers).get('Authorization')).toBe(
      'Bearer access-2',
    );
  });

  it('clears the session when the refresh token is also dead', async () => {
    localStorage.setItem(ACCESS, 'expired');
    localStorage.setItem(REFRESH, 'revoked');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }))
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }));

    await expect(apiRequest('/admin/users')).rejects.toMatchObject({
      error: { statusCode: 401, code: 'UNAUTHORIZED' },
    });
    expect(localStorage.getItem(ACCESS)).toBeNull();
    expect(localStorage.getItem(REFRESH)).toBeNull();
  });

  it('passes a 401 straight through when there is no refresh token to try', async () => {
    // Documented rather than changed: with no refresh token stored there is
    // nothing to retry with, so the API's own 401 is what the caller sees.
    localStorage.setItem(ACCESS, 'expired');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'Token expired' }),
    );

    await expect(apiRequest('/admin/users')).rejects.toMatchObject({
      error: { statusCode: 401, message: 'Token expired' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the API's own code and message on a failure", async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, code: 'FORBIDDEN', message: 'Not permitted' }),
    );

    const error = (await apiRequest('/admin/users').catch((e) => e)) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.error).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('falls back to the HTTP status when the body is not JSON', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    await expect(apiRequest('/admin/users')).rejects.toMatchObject({
      error: { statusCode: 502, code: 'REQUEST_FAILED' },
    });
  });
});
