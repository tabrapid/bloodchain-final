import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiRequest, refreshAccessToken } from './api-client';

/**
 * P3-2 (second installment): the first tests this dashboard has ever had.
 *
 * They target the request helper rather than a page, because that is where the
 * bugs actually were. Until this file's subject existed, every `lib/*.ts`
 * module carried its own copy of this function and its own `ApiRequestError`
 * class, and none of the copies refreshed an expired token — see the header of
 * api-client.ts. Each test below names the behaviour that was missing.
 */

const ACCESS = 'donor_access_token';
const REFRESH = 'donor_refresh_token';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to send a request with no access token', async () => {
    await expect(apiRequest('/shipments')).rejects.toMatchObject({
      error: { statusCode: 401, code: 'NO_TOKEN' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token and unwraps the { data } envelope', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: 'ship-1' } }));

    const result = await apiRequest<{ id: string }>('/shipments/ship-1');

    expect(result).toEqual({ id: 'ship-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/v1/shipments/ship-1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('refreshes and retries once when the access token has expired', async () => {
    // The bug this replaces: access tokens live 15 minutes and none of the
    // per-module copies of this helper refreshed, so every dashboard action
    // after that window failed until the user reloaded the page.
    localStorage.setItem(ACCESS, 'expired');
    localStorage.setItem(REFRESH, 'refresh-1');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'ship-1' } }));

    const result = await apiRequest<{ id: string }>('/shipments/ship-1');

    expect(result).toEqual({ id: 'ship-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The retry carries the new token, and the rotated pair is persisted.
    const retryInit = fetchMock.mock.calls[2]![1];
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
    expect(localStorage.getItem(ACCESS)).toBe('access-2');
    expect(localStorage.getItem(REFRESH)).toBe('refresh-2');
  });

  it('clears the session and reports it when the refresh token is also dead', async () => {
    localStorage.setItem(ACCESS, 'expired');
    localStorage.setItem(REFRESH, 'revoked');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }))
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }));

    await expect(apiRequest('/shipments')).rejects.toMatchObject({
      error: { statusCode: 401, code: 'SESSION_EXPIRED' },
    });

    expect(localStorage.getItem(ACCESS)).toBeNull();
    expect(localStorage.getItem(REFRESH)).toBeNull();
  });

  it('does not retry a 401 when there is no refresh token to use', async () => {
    localStorage.setItem(ACCESS, 'expired');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { statusCode: 401 }));

    await expect(apiRequest('/shipments')).rejects.toMatchObject({
      error: { code: 'SESSION_EXPIRED' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the API's own message and status on a failure", async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { statusCode: 409, code: 'CONFLICT', message: 'Unit already reserved' }),
    );

    await expect(apiRequest('/inventory/reserve')).rejects.toMatchObject({
      error: { statusCode: 409, code: 'CONFLICT', message: 'Unit already reserved' },
    });
  });

  it('falls back to the HTTP status when the body is not JSON', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    await expect(apiRequest('/shipments')).rejects.toMatchObject({
      error: { statusCode: 502, code: 'API_ERROR', message: 'Request failed' },
    });
  });

  it('lets the caller override headers without losing the Authorization header', async () => {
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: null }));

    await apiRequest('/uploads', { method: 'POST', headers: { 'X-Trace': 'abc' } });

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(headers['X-Trace']).toBe('abc');
  });

  it('throws one error type across every module, so instanceof works', async () => {
    // Each lib/*.ts used to declare its own ApiRequestError class, which made
    // `err instanceof ApiRequestError` false whenever the error came from a
    // different module than the class was imported from — so pages fell
    // through to their generic fallback message.
    localStorage.setItem(ACCESS, 'access-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { statusCode: 400, message: 'Bad' }));

    const error = (await apiRequest('/shipments').catch((e) => e)) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Bad');
  });
});

describe('refreshAccessToken', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling the API when there is no refresh token', async () => {
    expect(await refreshAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the network is down', async () => {
    localStorage.setItem(REFRESH, 'refresh-1');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await refreshAccessToken()).toBeNull();
  });
});
