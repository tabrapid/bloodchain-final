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

import {
  getTrendSummary,
  getAvailableParameters,
  getParameterTrend,
  getParameterStatistics,
  getParameterHistory,
} from './health-trends';

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/**
 * Every function in this file called `apiRequest<{ data: T }>(...)` and then
 * returned `response.data` -- but `apiRequest` already strips exactly one
 * `{ data: ... }` envelope (the backend hand-wraps every route here in
 * exactly one, per health-trends.controller.ts's `return { data: ... }`).
 * That's a double-unwrap: `response` at runtime was already the real T with
 * no `.data` property, so `response.data` always resolved to `undefined` --
 * silently, with no thrown error, so callers (health-trends/index.tsx,
 * health.tsx) never saw an error either, just an empty summary that looked
 * exactly like "no data yet" for every single user, always.
 */
describe('health-trends API client (bug: double .data unwrap on an already-unwrapped response)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('getTrendSummary resolves to the summary object directly, not undefined', async () => {
    mockFetchOnce({ data: { totalTests: 4, availableParameters: [] } });

    const result = await getTrendSummary();

    expect(result).toEqual({ totalTests: 4, availableParameters: [] });
    expect(result).not.toBeUndefined();
  });

  it('getAvailableParameters resolves to the array directly, not undefined', async () => {
    mockFetchOnce({ data: [{ code: 'HGB', name: 'Hemoglobin', category: 'CBC', measurementCount: 3 }] });

    const result = await getAvailableParameters();

    expect(result).toEqual([{ code: 'HGB', name: 'Hemoglobin', category: 'CBC', measurementCount: 3 }]);
  });

  it('getParameterTrend resolves to the trend object directly, not undefined', async () => {
    mockFetchOnce({ data: { parameterCode: 'HGB', trend: 'STABLE', points: [] } });

    const result = await getParameterTrend('HGB');

    expect(result).toEqual({ parameterCode: 'HGB', trend: 'STABLE', points: [] });
  });

  it('getParameterStatistics resolves to the stats object directly, not undefined', async () => {
    mockFetchOnce({ data: { parameterCode: 'HGB', parameterName: 'Hemoglobin', measurementCount: 5 } });

    const result = await getParameterStatistics('HGB');

    expect(result).toEqual({ parameterCode: 'HGB', parameterName: 'Hemoglobin', measurementCount: 5 });
  });

  it('getParameterHistory resolves to the history object directly, not undefined', async () => {
    mockFetchOnce({ data: { parameterCode: 'HGB', history: [], total: 0 } });

    const result = await getParameterHistory('HGB');

    expect(result).toEqual({ parameterCode: 'HGB', history: [], total: 0 });
  });
});
