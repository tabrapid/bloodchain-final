import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  geoName,
  getDirectoryEntry,
  getGeographyCoverage,
  listDistricts,
  listRegions,
  updateDirectoryEntry,
  weekOfHours,
} from './directory';

/**
 * These drive the real `apiRequest` — including its `const { data } = ...` step
 * — over a mocked `fetch`. The payloads are the shape the running API sends:
 * `apps/api/test/client-contract.e2e-spec.ts` asserts the same fields against
 * the live application, so a server that stops enveloping these routes turns
 * that suite red rather than leaving this one passing against an assumption.
 *
 * Sprint 2 shipped `/geography/*` and `GET /organizations/:id` unenveloped.
 * `applyEntry()` on the Organization page reads `entry.region?.id` first, which
 * throws on `undefined`, is caught by the page's own try/catch, and leaves a
 * permanent empty state with nothing logged where an operator would look.
 */

const ACCESS = 'donor_access_token';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const REGION = {
  id: 'region-tk',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE' as const,
  districtCount: 5,
};

const DISTRICT = {
  id: 'district-chilonzor',
  code: 'chilonzor',
  regionId: 'region-tk',
  nameUz: 'Chilonzor tumani',
  nameRu: 'Чиланзарский район',
  nameEn: 'Chilanzar District',
  source: 'DEMO' as const,
};

const ENTRY = {
  id: 'org-1',
  type: 'HOSPITAL',
  name: 'Demo City Hospital',
  legalName: null,
  phone: null,
  publicPhone: '+998 71 000 00 00',
  email: null,
  address: '1 Demo Street',
  directionsNote: null,
  latitude: '41.2756',
  longitude: '69.2044',
  status: 'ACTIVE',
  acceptsDonations: true,
  providesLaboratory: false,
  verifiedAt: null,
  isVerified: false,
  isDemo: true,
  region: REGION,
  district: DISTRICT,
  services: [{ service: 'WHOLE_BLOOD_DONATION', note: null }],
  hours: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false }],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(ACCESS, 'token');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

function lastUrl() {
  return new URL(fetchMock.mock.calls.at(-1)![0] as string);
}

describe('listRegions', () => {
  it('returns the list the region select renders, not the envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [REGION] }));

    const regions = await listRegions();

    expect(regions).toHaveLength(1);
    expect(regions[0]!.nameEn).toBe('Tashkent City');
    expect(lastUrl().pathname).toBe('/api/v1/geography/regions');
  });
});

describe('listDistricts', () => {
  it('asks only for the chosen region', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [DISTRICT] }));

    const districts = await listDistricts('region-tk');

    expect(districts[0]!.regionId).toBe('region-tk');
    expect(lastUrl().searchParams.get('regionId')).toBe('region-tk');
  });
});

describe('getGeographyCoverage', () => {
  it('returns the flag the demo-district line branches on', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          regions: { total: 14, official: 14, demo: 0 },
          districts: { total: 20, official: 0, demo: 20 },
          districtsAuthoritative: false,
          regionStandard: 'ISO 3166-2:UZ',
        },
      }),
    );

    const coverage = await getGeographyCoverage();

    expect(coverage.districtsAuthoritative).toBe(false);
  });
});

describe('getDirectoryEntry', () => {
  it('returns an entry the form can be filled from', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: ENTRY }));

    const entry = await getDirectoryEntry('org-1');

    // Every field `applyEntry()` reads, in the order it reads them.
    expect(entry.region?.id).toBe('region-tk');
    expect(entry.district?.id).toBe('district-chilonzor');
    expect(entry.address).toBe('1 Demo Street');
    expect(entry.latitude).toBe('41.2756');
    expect(entry.publicPhone).toBe('+998 71 000 00 00');
    expect(entry.acceptsDonations).toBe(true);
    expect(entry.services).toHaveLength(1);
    expect(entry.isDemo).toBe(true);
  });

  /**
   * Pinned, not fixed: the client has no fallback on purpose, so a bare body
   * still reaches the page as `undefined`. The server-side contract suite is
   * what keeps that from happening, not a shrug here.
   */
  it('has no fallback: a bare body reaches the page as undefined', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, ENTRY));

    await expect(getDirectoryEntry('org-1')).resolves.toBeUndefined();
  });
});

describe('updateDirectoryEntry', () => {
  it('returns the saved entry the form re-applies itself from', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: { ...ENTRY, directionsNote: 'Behind the pharmacy' } }),
    );

    const saved = await updateDirectoryEntry('org-1', { directionsNote: 'Behind the pharmacy' });

    expect(saved.directionsNote).toBe('Behind the pharmacy');
    expect(lastUrl().pathname).toBe('/api/v1/organizations/org-1/directory');
    expect(fetchMock.mock.calls.at(-1)![1]).toEqual(
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('weekOfHours', () => {
  it('fills the days the API did not send, so the form never invents a row', () => {
    const week = weekOfHours([
      { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false },
    ]);

    expect(week).toHaveLength(7);
    expect(week.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week[1]!.opensAt).toBe('09:00');
    expect(week[0]!.isClosed).toBe(true);
  });
});

describe('geoName', () => {
  it.each([
    ['uz', 'Toshkent shahri'],
    ['ru', 'город Ташкент'],
    ['en', 'Tashkent City'],
  ])('reads the %s name', (locale, expected) => {
    expect(geoName(REGION, locale)).toBe(expected);
  });
});
