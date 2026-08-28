import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBloodRequests, getShipments } from './shipments';

/**
 * P0-12 regression tests. See hospital-web/lib/shipments.spec.ts for the full
 * explanation — same bug, same two functions duplicated into this app.
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: requests })));

    const result = await getBloodRequests('org-1');

    expect(result).toEqual(requests);
    expect((result as unknown as { data?: unknown }).data).toBeUndefined();
  });

  it('getShipments resolves directly to the array', async () => {
    const shipments = [{ id: 'ship-1', status: 'DISPATCHED' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: shipments })));

    const result = await getShipments('org-1');

    expect(result).toEqual(shipments);
  });
});
