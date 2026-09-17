jest.mock('../auth/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getRefreshToken: jest.fn().mockResolvedValue('test-refresh-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

import { geoName, getDistricts, getGeographyCoverage, getRegions } from './geography';

/**
 * These drive the real `apiRequest` — including its `return json.data` step —
 * over a mocked `fetch`. The payloads below are the shape the API actually
 * sends, not the shape this client would like: `client-contract.e2e-spec.ts`
 * asserts the same fields against the running application, so if the server
 * ever stops enveloping these routes that suite goes red rather than this one
 * quietly continuing to pass against an assumption.
 *
 * That distinction is the whole reason this file exists. Sprint 2 shipped these
 * three routes unenveloped; every client call evaluated to `undefined`, the
 * region picker rendered empty, and nothing failed anywhere — because there was
 * no test at this layer at all.
 */
function respondWith(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

const TASHKENT = {
  id: 'region-tk',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE',
  districtCount: 5,
};

const CHILONZOR = {
  id: 'district-chilonzor',
  code: 'chilonzor',
  regionId: 'region-tk',
  nameUz: 'Chilonzor tumani',
  nameRu: 'Чиланзарский район',
  nameEn: 'Chilanzar District',
  source: 'DEMO',
};

function requestedUrl() {
  const call = (global.fetch as jest.Mock).mock.calls.at(-1);
  return new URL(call[0] as string);
}

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('getRegions', () => {
  it('returns the list the picker maps over, not the envelope around it', async () => {
    respondWith({ data: [TASHKENT] });

    const regions = await getRegions();

    expect(Array.isArray(regions)).toBe(true);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.nameEn).toBe('Tashkent City');
    expect(regions[0]?.districtCount).toBe(5);
    expect(requestedUrl().pathname).toBe('/api/v1/geography/regions');
  });

  /**
   * The failure mode, pinned rather than fixed.
   *
   * `apiRequest` has no fallback, by design: a client-side `?? body` would hide
   * a broken contract behind a shrug and make the two sides disagree silently
   * forever. So a bare body really does reach the screen as `undefined`, and
   * `regions.map(...)` really does render nothing. What stops that reaching
   * production is `client-contract.e2e-spec.ts`, which asserts the envelope
   * against the running API — not a guard here.
   */
  it('has no fallback: a bare body reaches the caller as undefined', async () => {
    respondWith([TASHKENT]);

    await expect(getRegions()).resolves.toBeUndefined();
  });
});

describe('getDistricts', () => {
  it('scopes the request to one region and returns its districts', async () => {
    respondWith({ data: [CHILONZOR] });

    const districts = await getDistricts('region-tk');

    expect(districts).toHaveLength(1);
    expect(districts[0]?.regionId).toBe('region-tk');
    expect(requestedUrl().searchParams.get('regionId')).toBe('region-tk');
  });

  it('asks for every district when no region is given', async () => {
    respondWith({ data: [] });

    await getDistricts();

    expect(requestedUrl().search).toBe('');
  });
});

describe('getGeographyCoverage', () => {
  it('returns the flag the demo-district notice branches on', async () => {
    respondWith({
      data: {
        regions: { total: 14, official: 14, demo: 0 },
        districts: { total: 20, official: 0, demo: 20 },
        districtsAuthoritative: false,
        regionStandard: 'ISO 3166-2:UZ',
      },
    });

    const coverage = await getGeographyCoverage();

    // `coverage?.districtsAuthoritative === false` is the exact predicate the
    // filter panel and both portal forms use. Against `undefined` it is false,
    // and the notice never appears — a warning that fails open.
    expect(coverage?.districtsAuthoritative).toBe(false);
    expect(coverage.regionStandard).toBe('ISO 3166-2:UZ');
  });
});

describe('geoName', () => {
  it.each([
    ['uz', 'Toshkent shahri'],
    ['ru', 'город Ташкент'],
    ['en', 'Tashkent City'],
  ])('reads the %s name', (locale, expected) => {
    expect(geoName(TASHKENT, locale)).toBe(expected);
  });

  it('falls back to English, the only name guaranteed to be filled in', () => {
    expect(geoName({ nameUz: '', nameRu: '', nameEn: 'Tashkent City' }, 'uz')).toBe('Tashkent City');
  });
});
