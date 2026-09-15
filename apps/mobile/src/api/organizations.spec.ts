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

import { capabilityFor, discoverOrganizations, getOrganization } from './organizations';

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/** The path and query string of the single request that was made. */
function requestedUrl() {
  const call = (global.fetch as jest.Mock).mock.calls.at(-1);
  return new URL(call[0] as string);
}

const page = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('capabilityFor', () => {
  /**
   * The booking flow works in appointment types and the directory in
   * capabilities. Sending `BLOOD_DONATION` straight through as `type` asks the
   * server for an organization *type* that does not exist, which is a 400 and
   * an empty location step.
   */
  it('asks for somewhere that takes donations when booking a donation', () => {
    expect(capabilityFor('BLOOD_DONATION')).toEqual({ acceptsDonations: true });
  });

  it('asks for a laboratory when booking a test', () => {
    expect(capabilityFor('BLOOD_TEST')).toEqual({ providesLaboratory: true });
  });

  it('narrows nothing for an appointment type with no capability of its own', () => {
    expect(capabilityFor('CONSULTATION')).toEqual({});
    expect(capabilityFor(undefined)).toEqual({});
  });

  it('never returns an organization type', () => {
    for (const type of ['BLOOD_DONATION', 'BLOOD_TEST', 'CONSULTATION']) {
      expect(capabilityFor(type)).not.toHaveProperty('type');
    }
  });
});

describe('discoverOrganizations query building', () => {
  it('sends only the filters that were set', async () => {
    mockFetchOnce(page);
    await discoverOrganizations({ regionId: 'r1', acceptsDonations: true });
    const url = requestedUrl();
    expect(url.pathname).toBe('/api/v1/organizations/discover');
    expect(url.searchParams.get('regionId')).toBe('r1');
    expect(url.searchParams.get('acceptsDonations')).toBe('true');
    expect(url.searchParams.has('districtId')).toBe(false);
    expect(url.searchParams.has('service')).toBe(false);
  });

  it('spells false as "false" rather than dropping it', async () => {
    mockFetchOnce(page);
    await discoverOrganizations({ providesLaboratory: false });
    expect(requestedUrl().searchParams.get('providesLaboratory')).toBe('false');
  });

  it('sends a location only when all three parts of it are known', async () => {
    mockFetchOnce(page);
    await discoverOrganizations({ latitude: 41.3, radiusKm: 25 });
    let url = requestedUrl();
    expect(url.searchParams.has('latitude')).toBe(false);
    expect(url.searchParams.has('radiusKm')).toBe(false);

    mockFetchOnce(page);
    await discoverOrganizations({ latitude: 41.3, longitude: 69.25, radiusKm: 25 });
    url = requestedUrl();
    expect(url.searchParams.get('latitude')).toBe('41.3');
    expect(url.searchParams.get('longitude')).toBe('69.25');
    expect(url.searchParams.get('radiusKm')).toBe('25');
  });

  it('drops a search term that is only whitespace', async () => {
    mockFetchOnce(page);
    await discoverOrganizations({ search: '   ' });
    expect(requestedUrl().searchParams.has('search')).toBe(false);

    mockFetchOnce(page);
    await discoverOrganizations({ search: '  chilonzor ' });
    expect(requestedUrl().searchParams.get('search')).toBe('chilonzor');
  });

  it('keeps the pagination totals the envelope carries', async () => {
    mockFetchOnce({
      data: [{ id: 'org-1' }],
      meta: { page: 1, limit: 20, total: 7, totalPages: 1, radiusKm: 25 },
    });
    const result = await discoverOrganizations({});
    expect(result.organizations).toHaveLength(1);
    expect(result.total).toBe(7);
    expect(result.radiusKm).toBe(25);
  });

  it('survives a response with no meta', async () => {
    mockFetchOnce({ data: [{ id: 'org-1' }, { id: 'org-2' }] });
    const result = await discoverOrganizations({});
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
  });
});

describe('getOrganization', () => {
  it('asks for the one organization rather than listing all of them', async () => {
    mockFetchOnce({ data: { id: 'org 1', name: 'Demo' } });
    await getOrganization('org 1');
    expect(requestedUrl().pathname).toBe('/api/v1/organizations/org%201');
  });
});
