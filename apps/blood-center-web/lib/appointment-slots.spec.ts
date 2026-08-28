import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { blockSlot, createSlot, getSlots, updateSlot } from './appointment-slots';

/**
 * P0-12 regression tests. See hospital-web/lib/shipments.spec.ts for the full
 * explanation. All four of AppointmentSlotsService's methods hand-wrap their
 * own `{ data: ... }`, and AppointmentSlotsController carries no
 * WrapResponseInterceptor, so `apiRequest`'s unwrap always resolves to the
 * plain payload — never the `{ data: ... }` these four were typed to return.
 */

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('appointment-slots.ts: functions resolve to the real API shape', () => {
  beforeEach(() => {
    localStorage.setItem('donor_access_token', 'access-1');
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('getSlots resolves directly to the array', async () => {
    const slots = [{ id: 'slot-1', status: 'AVAILABLE' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: slots })));

    const result = await getSlots('org-1');

    expect(result).toEqual(slots);
  });

  it('createSlot resolves directly to the created slot', async () => {
    const slot = { id: 'slot-1', status: 'AVAILABLE' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: slot })));

    const result = await createSlot('org-1', {
      appointmentType: 'BLOOD_DONATION',
      startAt: '2026-09-01T09:00:00.000Z',
      endAt: '2026-09-01T09:30:00.000Z',
    });

    expect(result).toEqual(slot);
  });

  it('updateSlot resolves directly to the updated slot', async () => {
    const slot = { id: 'slot-1', status: 'AVAILABLE', capacity: 5 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: slot })));

    const result = await updateSlot('org-1', 'slot-1', { capacity: 5 });

    expect(result).toEqual(slot);
  });

  it('blockSlot resolves directly to the blocked slot', async () => {
    const slot = { id: 'slot-1', status: 'BLOCKED' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: slot })));

    const result = await blockSlot('org-1', 'slot-1');

    expect(result).toEqual(slot);
  });
});
