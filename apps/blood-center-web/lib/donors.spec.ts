import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Donor, listDonors, verifyBloodType } from './donors';

/**
 * These drive the real request helpers over a mocked `fetch`, against the shape
 * the running API actually sends. `/donors` answers a bare `{ data, meta }`
 * (no WrapResponseInterceptor), while `POST /donors/:id/verify-blood-type`
 * answers `{ data }` — two different unwrap paths in the same file, which is
 * exactly the kind of difference that goes unnoticed until a screen renders
 * `undefined`.
 */

const ACCESS = 'donor_access_token';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const SELF_REPORTED: Donor = {
  id: 'profile-1',
  userId: 'user-1',
  bloodType: 'AB',
  rhFactor: 'NEGATIVE',
  city: 'Jizzakh',
  district: null,
  donorStatus: 'ACTIVE',
  verificationStatus: 'UNVERIFIED',
  bloodTypeVerifiedAt: null,
  bloodTypeVerifiedBy: null,
  bloodTypeSource: null,
  bloodTypeNote: null,
  createdAt: '2026-01-05T10:00:00.000Z',
  user: { id: 'user-1', email: 'aziza@example.uz', firstName: 'Aziza', lastName: 'Karimova' },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(ACCESS, 'token');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

function lastCall() {
  return fetchMock.mock.calls.at(-1)!;
}

function lastUrl() {
  return new URL(lastCall()[0] as string);
}

describe('listDonors', () => {
  it('returns the rows and the pagination the table needs', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [SELF_REPORTED],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const page = await listDonors();

    expect(page.data[0]!.user.firstName).toBe('Aziza');
    expect(page.data[0]!.verificationStatus).toBe('UNVERIFIED');
    expect(page.meta.total).toBe(1);
  });

  it('sends the staff search term, so a donor can be found by name', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }));

    await listDonors({ search: 'Karimova', verificationStatus: 'REQUIRES_REVIEW' });

    expect(lastUrl().searchParams.get('search')).toBe('Karimova');
    expect(lastUrl().searchParams.get('verificationStatus')).toBe('REQUIRES_REVIEW');
  });

  it('omits filters that were never set rather than sending empty ones', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }));

    await listDonors({ page: 2 });

    expect(lastUrl().searchParams.get('search')).toBeNull();
    expect(lastUrl().searchParams.get('bloodType')).toBeNull();
  });
});

describe('verifyBloodType', () => {
  it('unwraps the verified profile the staff panel re-renders from', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          ...SELF_REPORTED,
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          verificationStatus: 'VERIFIED',
          bloodTypeVerifiedAt: '2026-09-17T09:00:00.000Z',
          bloodTypeVerifiedBy: 'staff-1',
          bloodTypeSource: 'LABORATORY',
        },
      }),
    );

    const updated = await verifyBloodType('user-1', {
      bloodType: 'O',
      rhFactor: 'POSITIVE',
      source: 'LABORATORY',
    });

    expect(updated.verificationStatus).toBe('VERIFIED');
    expect(updated.bloodType).toBe('O');
    expect(updated.bloodTypeVerifiedBy).toBe('staff-1');
  });

  it('posts to the donor it was given, and claims no provenance of its own', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: SELF_REPORTED }));

    await verifyBloodType('user-1', {
      bloodType: 'O',
      rhFactor: 'POSITIVE',
      source: 'LABORATORY',
      note: 'lab slip 4471',
    });

    const [url, init] = lastCall() as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/donors/user-1/verify-blood-type');
    expect(init.method).toBe('POST');

    // Who verified and when are the server's to decide. If this request ever
    // starts carrying them, the audit trail becomes client-supplied.
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(['bloodType', 'note', 'rhFactor', 'source']);
  });

  it('surfaces the refusal when the API says the caller may not verify', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'A blood type cannot be verified by the donor it belongs to.',
      }),
    );

    await expect(verifyBloodType('user-1', { bloodType: 'O', rhFactor: 'POSITIVE', source: 'LABORATORY' }))
      .rejects.toThrow('A blood type cannot be verified by the donor it belongs to.');
  });
});
