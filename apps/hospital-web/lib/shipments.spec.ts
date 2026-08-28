import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBloodRequests, getIncomingShipments } from './shipments';

/**
 * P0-12 regression tests.
 *
 * Both functions were typed `Promise<{ data: T[] }>` and callers read
 * `result.data`. But `apiRequest` (see api-client.ts) already unwraps the
 * HTTP response's top-level `data` field before returning — and the backend
 * for both these endpoints hand-wraps its own payload as `{ data: [...] }`
 * with no double-wrapping interceptor. So the real resolved value was always
 * the plain array, `result.data` was `undefined`, and every caller's
 * `.filter(...)` on that `undefined` crashed the page — found live, by a
 * user testing the hospital dashboard for the first time.
 */

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('shipments.ts: functions resolve to the real API shape, not a fictional wrapper', () => {
  beforeEach(() => {
    localStorage.setItem('donor_access_token', 'access-1');
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('getBloodRequests resolves directly to the array', async () => {
    const requests = [{ id: 'req-1', status: 'SUBMITTED' }];
    // The backend hand-wraps as { data: requests } with no interceptor, so
    // this IS the real HTTP body — not a stand-in for something simpler.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: requests })));

    const result = await getBloodRequests('org-1');

    expect(result).toEqual(requests);
    expect((result as unknown as { data?: unknown }).data).toBeUndefined();
  });

  it('getIncomingShipments resolves directly to the array', async () => {
    const shipments = [{ id: 'ship-1', status: 'IN_TRANSIT' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: shipments })));

    const result = await getIncomingShipments('org-1');

    expect(result).toEqual(shipments);
  });
});
