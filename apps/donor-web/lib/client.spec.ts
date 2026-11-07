import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, apiRequestEnvelope } from './api/client';
import { getMyDonations } from './api/donations';
afterEach(() => vi.unstubAllGlobals());
describe('donor web API transport', () => {
  it('preserves donation pagination from the response envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [{ id: 'donation' }],
          meta: { page: 2, totalPages: 4, total: 60 },
        }),
      ),
    );
    const result = await getMyDonations({ page: 2, limit: 15 });
    expect(result.data[0]!.id).toBe('donation');
    expect(result.meta?.totalPages).toBe(4);
  });
  it('retries once after cookie refresh without reading tokens in JavaScript', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: 'Expired' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'donor' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await apiRequest('/api/v1/auth/me')).toEqual({ id: 'donor' });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/auth/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/me',
    ]);
    expect(fetch.mock.calls[0]![1].credentials).toBe('same-origin');
  });
  it('does not report rejected booking as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 'SLOT_FULL', message: 'Slot is full' }, { status: 409 }),
        ),
    );
    await expect(
      apiRequest('/api/v1/appointments', { method: 'POST', body: '{}' }),
    ).rejects.toThrow('Slot is full');
  });
  it('announces revoked sessions and retains error details', async () => {
    const expired = vi.fn();
    window.addEventListener('donor:session-expired', expired);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ message: 'Session revoked' }, { status: 401 })),
    );
    await expect(apiRequest('/api/v1/donors/profile')).rejects.toThrow('Session revoked');
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('donor:session-expired', expired);
  });
  it('retains response metadata and rejects external paths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: [], meta: { total: 3 } })),
    );
    expect((await apiRequestEnvelope('/api/v1/donations/me')).meta).toEqual({ total: 3 });
    await expect(apiRequest('https://external.test')).rejects.toThrow('Invalid API path');
  });
});
