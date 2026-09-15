import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderLocalized } from '../../lib/test-render';

/**
 * The directory entry is what a donor reads before travelling somewhere to give
 * blood, and three of its fields can go wrong quietly: a district left over
 * from a region the organization has moved out of (which the server rejects, so
 * every later save fails for a reason the form never explains), a closed day
 * saved with opening times still attached, and a coordinate that is not a
 * number reaching an endpoint that will simply refuse it.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/organization',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('../../lib/auth', () => ({
  me: vi.fn(),
  isAuthenticated: () => true,
  logout: vi.fn(),
}));
vi.mock('../../lib/directory', async () => {
  const actual = await vi.importActual<typeof import('../../lib/directory')>(
    '../../lib/directory',
  );
  return {
    ...actual,
    listRegions: vi.fn(),
    listDistricts: vi.fn(),
    getGeographyCoverage: vi.fn(),
    getDirectoryEntry: vi.fn(),
    updateDirectoryEntry: vi.fn(),
  };
});

import { me } from '../../lib/auth';
import {
  getDirectoryEntry,
  getGeographyCoverage,
  listDistricts,
  listRegions,
  updateDirectoryEntry,
} from '../../lib/directory';
import OrganizationDirectoryPage from './page';

const tashkent = {
  id: 'region-tk',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE' as const,
  districtCount: 1,
};

const samarkand = {
  ...tashkent,
  id: 'region-sa',
  code: 'UZ-SA',
  nameUz: 'Samarqand viloyati',
  nameRu: 'Самаркандская область',
  nameEn: 'Samarkand Region',
};

const chilonzor = {
  id: 'district-chilonzor',
  code: 'chilonzor',
  regionId: 'region-tk',
  nameUz: 'Chilonzor tumani',
  nameRu: 'Чиланзарский район',
  nameEn: 'Chilanzar District',
  source: 'DEMO' as const,
};

const samarkandCity = {
  ...chilonzor,
  id: 'district-samarkand',
  code: 'samarqand-shahri',
  regionId: 'region-sa',
  nameEn: 'Samarkand City',
};

const entry = {
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
  region: tashkent,
  district: chilonzor,
  services: [{ service: 'WHOLE_BLOOD_DONATION' as const, note: null }],
  hours: [
    { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
    { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(me).mockResolvedValue({
    id: 'user-1',
    email: 'admin@example.local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true,
    roles: ['HOSPITAL_ADMIN'],
    organizations: [
      {
        membershipId: 'm-1',
        organizationId: 'org-1',
        name: 'Demo City Hospital',
        type: 'HOSPITAL',
        role: 'HOSPITAL_ADMIN',
        status: 'ACTIVE',
        organizationStatus: 'ACTIVE',
      },
    ],
    donorProfile: null,
  } as never);
  vi.mocked(listRegions).mockResolvedValue([tashkent, samarkand]);
  vi.mocked(listDistricts).mockImplementation(async (regionId?: string) =>
    regionId === 'region-sa' ? [samarkandCity] : [chilonzor],
  );
  vi.mocked(getGeographyCoverage).mockResolvedValue({
    regions: { total: 2, official: 2, demo: 0 },
    districts: { total: 2, official: 0, demo: 2 },
    districtsAuthoritative: false,
    regionStandard: 'ISO 3166-2:UZ',
  });
  vi.mocked(getDirectoryEntry).mockResolvedValue(entry as never);
  vi.mocked(updateDirectoryEntry).mockResolvedValue(entry as never);
});

async function renderPage() {
  const result = renderLocalized(<OrganizationDirectoryPage />);
  await screen.findByDisplayValue('1 Demo Street');
  return result;
}

describe('Organization directory entry', () => {
  it('loads the organization the signed-in administrator belongs to', async () => {
    await renderPage();
    expect(getDirectoryEntry).toHaveBeenCalledWith('org-1');
    expect(screen.getByDisplayValue('+998 71 000 00 00')).toBeTruthy();
  });

  it('says the districts on offer are demo data', async () => {
    await renderPage();
    expect(
      screen.getByText(/District names are sample data/i),
    ).toBeTruthy();
  });

  it('drops a district that does not belong to the newly chosen region', async () => {
    await renderPage();
    const [regionSelect] = screen.getAllByRole('combobox');
    // The district options arrive with their region, so the saved district only
    // becomes the select's value once that list has loaded.
    await waitFor(() =>
      expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe(
        'district-chilonzor',
      ),
    );

    await userEvent.selectOptions(regionSelect as HTMLSelectElement, 'region-sa');
    await waitFor(() =>
      expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe(''),
    );

    await userEvent.click(screen.getByRole('button', { name: /save directory entry/i }));
    await waitFor(() => expect(updateDirectoryEntry).toHaveBeenCalled());
    const [, payload] = vi.mocked(updateDirectoryEntry).mock.calls[0]!;
    expect(payload.regionId).toBe('region-sa');
    expect(payload.districtId).toBeNull();
  });

  it('saves a closed day without opening times', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /save directory entry/i }));
    await waitFor(() => expect(updateDirectoryEntry).toHaveBeenCalled());

    const [, payload] = vi.mocked(updateDirectoryEntry).mock.calls[0]!;
    expect(payload.hours).toHaveLength(7);
    const sunday = payload.hours!.find((day) => day.dayOfWeek === 0)!;
    expect(sunday.isClosed).toBe(true);
    expect(sunday.opensAt).toBeUndefined();
    const monday = payload.hours!.find((day) => day.dayOfWeek === 1)!;
    expect(monday).toEqual({ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' });
  });

  it('refuses a coordinate that is not a number instead of sending it', async () => {
    await renderPage();
    const latitude = screen.getByDisplayValue('41.2756');
    await userEvent.clear(latitude);
    await userEvent.type(latitude, 'north a bit');
    await userEvent.click(screen.getByRole('button', { name: /save directory entry/i }));

    expect(updateDirectoryEntry).not.toHaveBeenCalled();
    expect(screen.getByText(/must be numbers, or left empty/i)).toBeTruthy();
  });

  it('clears a coordinate by emptying the field rather than sending nothing', async () => {
    await renderPage();
    const latitude = screen.getByDisplayValue('41.2756');
    await userEvent.clear(latitude);
    const longitude = screen.getByDisplayValue('69.2044');
    await userEvent.clear(longitude);
    await userEvent.click(screen.getByRole('button', { name: /save directory entry/i }));

    await waitFor(() => expect(updateDirectoryEntry).toHaveBeenCalled());
    const [, payload] = vi.mocked(updateDirectoryEntry).mock.calls[0]!;
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
  });

  it('replaces the service list rather than adding to it', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('checkbox', { name: /whole blood donation/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /plasma donation/i }));
    await userEvent.click(screen.getByRole('button', { name: /save directory entry/i }));

    await waitFor(() => expect(updateDirectoryEntry).toHaveBeenCalled());
    const [, payload] = vi.mocked(updateDirectoryEntry).mock.calls[0]!;
    expect(payload.services).toEqual([{ service: 'PLASMA_DONATION' }]);
  });

  it('badges a demo organization', async () => {
    await renderPage();
    expect(screen.getByText(/Sample data, not a real organization/i)).toBeTruthy();
  });
});
