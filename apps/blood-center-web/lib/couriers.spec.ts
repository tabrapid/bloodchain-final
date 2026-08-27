import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCourierRoster } from './couriers';

/** P0-12 regression test. See hospital-web/lib/shipments.spec.ts for the full explanation. */

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('couriers.ts: getCourierRoster resolves to the real API shape', () => {
  beforeEach(() => {
    localStorage.setItem('donor_access_token', 'access-1');
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('resolves directly to the array, not { data: [...] }', async () => {
    const roster = [{ id: 'courier-1', displayName: 'A. Karimova', status: 'AVAILABLE' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: roster })));

    const result = await getCourierRoster('org-1');

    expect(result).toEqual(roster);
    expect((result as unknown as { data?: unknown }).data).toBeUndefined();
  });
});
