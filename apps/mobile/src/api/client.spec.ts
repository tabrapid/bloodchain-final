jest.mock('../auth/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getRefreshToken: jest.fn().mockResolvedValue('test-refresh-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
}));

import { apiRequest, apiRequestEnvelope, ApiRequestError } from './client';

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('apiRequest / apiRequestEnvelope', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  /**
   * The bug this whole file guards against (see P0-14/mobile audit): the
   * backend sends a single { data: T } envelope per route (either via
   * WrapResponseInterceptor or a service hand-wrap, never both unless a
   * route deliberately needs { data, meta }). apiRequest strips exactly one
   * level. A caller that declares Promise<{ data: T }> and reads `.data`
   * off the result is unwrapping twice -- the second `.data` is always
   * undefined, silently, because TypeScript has no way to check the
   * client's assumed shape against what the server actually sends.
   */
  it('resolves directly to the payload, not a second { data } wrapper', async () => {
    mockFetchOnce({ data: { id: 'donor-1', bloodType: 'O' } });

    const result = await apiRequest<{ id: string; bloodType: string }>('/donors/profile');

    expect(result).toEqual({ id: 'donor-1', bloodType: 'O' });
    // The bug this test exists to catch: reading `.data` on the resolved
    // value (as if apiRequest returned { data: T } instead of T) gives
    // undefined instead of a type error, because `result` is typed T.
    expect((result as any).data).toBeUndefined();
  });

  it('resolves an array payload directly, not wrapped', async () => {
    mockFetchOnce({ data: [{ id: 'a-1' }, { id: 'a-2' }] });

    const result = await apiRequest<Array<{ id: string }>>('/appointments/me');

    expect(result).toHaveLength(2);
    expect(Array.isArray(result)).toBe(true);
  });

  it('apiRequestEnvelope preserves meta alongside data, which apiRequest would silently discard', async () => {
    mockFetchOnce({
      data: [{ id: 'ship-1' }],
      meta: { total: 1, limit: 20, offset: 0 },
    });

    const envelope = await apiRequestEnvelope<Array<{ id: string }>>('/courier/shipments');

    expect(envelope.data).toEqual([{ id: 'ship-1' }]);
    expect(envelope.meta).toEqual({ total: 1, limit: 20, offset: 0 });
  });

  it('throws ApiRequestError with the server-provided message on a non-2xx response', async () => {
    mockFetchOnce({ statusCode: 404, code: 'NOT_FOUND', message: 'Donor profile not found.' }, 404);

    let caught: unknown;
    try {
      await apiRequest('/donors/profile');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Donor profile not found.' },
    });
  });

  it('attaches the bearer token from storage to every authenticated request', async () => {
    mockFetchOnce({ data: { ok: true } });

    await apiRequest('/users/me');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.get('Authorization')).toBe('Bearer test-access-token');
  });

  it('skips the Authorization header when skipAuth is set', async () => {
    mockFetchOnce({ data: { ok: true } });

    await apiRequest('/auth/login', { skipAuth: true, method: 'POST' });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.has('Authorization')).toBe(false);
  });

  /**
   * The bug a real user hit on a real device: a request to an unreachable
   * API (wrong LAN IP, a firewall silently dropping packets) has nothing
   * built into fetch() that ever gives up. Before this fix, "Signing
   * in..." just spun forever with no error and no way to recover.
   */
  it('times out and throws a catchable error instead of hanging forever', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const pending = apiRequest('/auth/login', { skipAuth: true, method: 'POST' });
    const assertion = expect(pending).rejects.toMatchObject({
      error: { code: 'REQUEST_TIMEOUT' },
    });

    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
    jest.useRealTimers();
  });

  it('surfaces an unreachable host as a network error, not a silent hang', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(apiRequest('/auth/login', { skipAuth: true, method: 'POST' })).rejects.toMatchObject({
      error: { code: 'NETWORK_ERROR' },
    });
  });
});
