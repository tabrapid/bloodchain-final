import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';

/**
 * The location step is where a donor decides which building to walk into, and
 * Sprint 2 gave it filters that can each silently return the wrong list: a
 * district kept from a region the donor has left, a nearby search that sends a
 * stale position, a permission refusal that reads as "no organizations here".
 *
 * These walk the real screen and assert what it asks the server for, because
 * the query is the only thing that decides what the donor sees.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../api/organizations', () => ({
  discoverOrganizations: jest.fn(),
  getOrganization: jest.fn(),
  capabilityFor: jest.requireActual('../api/organizations').capabilityFor,
}));
jest.mock('../api/geography', () => ({
  getRegions: jest.fn(),
  getDistricts: jest.fn(),
  getGeographyCoverage: jest.fn(),
  geoName: jest.requireActual('../api/geography').geoName,
}));

import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { discoverOrganizations } from '../api/organizations';
import { getDistricts, getGeographyCoverage, getRegions } from '../api/geography';

import SelectOrganization from '../../app/(booking)/organizations';
import { LocaleProvider } from '../i18n';
import { createLocalization } from '@bloodchain/i18n';

const { t } = createLocalization('en');

const region = {
  id: 'region-1',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE',
  districtCount: 1,
};

const district = {
  id: 'district-1',
  code: 'chilonzor',
  regionId: 'region-1',
  nameUz: 'Chilonzor tumani',
  nameRu: 'Чиланзарский район',
  nameEn: 'Chilanzar District',
  source: 'DEMO',
};

const organization = {
  id: 'org-1',
  type: 'BLOOD_CENTER',
  name: 'Demo Blood Centre',
  address: '1 Demo Street',
  directionsNote: null,
  publicPhone: null,
  phone: null,
  latitude: '41.3',
  longitude: '69.25',
  status: 'ACTIVE',
  acceptsDonations: true,
  providesLaboratory: false,
  isVerified: true,
  isDemo: true,
  region,
  district,
  services: [{ service: 'WHOLE_BLOOD_DONATION', note: null }],
  hours: [],
  distanceKm: 3.4,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ type: 'BLOOD_DONATION' } as never);
  jest.mocked(discoverOrganizations).mockResolvedValue({
    organizations: [organization],
    total: 1,
    totalPages: 1,
  } as never);
  jest.mocked(getRegions).mockResolvedValue([region] as never);
  jest.mocked(getDistricts).mockResolvedValue([district] as never);
  jest.mocked(getGeographyCoverage).mockResolvedValue({
    regions: { total: 1, official: 1, demo: 0 },
    districts: { total: 1, official: 0, demo: 1 },
    districtsAuthoritative: false,
    regionStandard: 'ISO 3166-2:UZ',
  } as never);
});

const mounted: renderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <LocaleProvider>
            <SafeAreaProvider
              initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
              }}
            >
              <SelectOrganization />
            </SafeAreaProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);
  await settle();
  return tree;
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function textUnder(instance: renderer.ReactTestInstance): string {
  const strings: string[] = [];
  const walk = (node: renderer.ReactTestInstance) => {
    node.children.forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else walk(child);
    });
  };
  walk(instance);
  return strings.join(' ');
}

function screenText(tree: renderer.ReactTestRenderer): string {
  return textUnder(tree.root);
}

function pressableWithText(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .filter((node) => textUnder(node).includes(label))
    .at(-1);
}

async function press(tree: renderer.ReactTestRenderer, label: string) {
  const target = pressableWithText(tree, label);
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
  await settle();
}

/**
 * A filter chip by the field it controls, not by the value it happens to show.
 *
 * Once a region is chosen the chip reads "Tashkent City" -- and so does the
 * organization card underneath it, so searching by visible text finds the card.
 */
async function pressChip(tree: renderer.ReactTestRenderer, field: string) {
  const target = tree.root.findAll(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      typeof node.props?.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(`${field}: `),
    { deep: true },
  )[0];
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
  await settle();
}

/** The filters of the most recent request the screen made. */
function lastQuery() {
  return jest.mocked(discoverOrganizations).mock.calls.at(-1)?.[0];
}

describe('Location step: what the filters ask for', () => {
  it('asks for somewhere that takes donations, not an organization type', async () => {
    await render();
    expect(lastQuery()).toEqual(expect.objectContaining({ acceptsDonations: true }));
    expect(lastQuery()).not.toHaveProperty('type', 'BLOOD_DONATION');
  });

  it('filters by region, and clears the district when the region changes', async () => {
    const tree = await render();
    await press(tree, t('directory.filters'));

    await pressChip(tree, t('directory.region'));
    await press(tree, region.nameEn);
    expect(lastQuery()).toEqual(expect.objectContaining({ regionId: 'region-1' }));

    await pressChip(tree, t('directory.district'));
    await press(tree, district.nameEn);
    expect(lastQuery()).toEqual(expect.objectContaining({ districtId: 'district-1' }));

    // Back to every region: the district belonged to the one just left, and
    // keeping it would filter on a district the region does not contain.
    await pressChip(tree, t('directory.region'));
    await press(tree, t('directory.anyRegion'));
    expect(lastQuery()?.regionId).toBeUndefined();
    expect(lastQuery()?.districtId).toBeUndefined();
  });

  it('says districts are demo data while they are', async () => {
    const tree = await render();
    await press(tree, t('directory.filters'));
    expect(screenText(tree)).toContain(t('directory.demoDistricts'));
  });

  it('badges a demo organization and shows how far away it is', async () => {
    const tree = await render();
    const text = screenText(tree);
    expect(text).toContain(t('directory.demo'));
    expect(text).toContain(t('directory.verified'));
    expect(text).toContain(t('directory.distanceAway', { km: 3.4 }));
  });

  it('clears every filter at once', async () => {
    const tree = await render();
    await press(tree, t('directory.filters'));
    await pressChip(tree, t('directory.region'));
    await press(tree, region.nameEn);
    expect(lastQuery()?.regionId).toBe('region-1');

    await press(tree, t('directory.clearFilters'));
    expect(lastQuery()?.regionId).toBeUndefined();
  });
});

describe('Location step: nearby search and location permission', () => {
  it('sends a position only once the donor has granted permission', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'undetermined',
    } as never);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as never);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 41.3, longitude: 69.25 },
    } as never);

    const tree = await render();
    await press(tree, t('directory.filters'));
    expect(lastQuery()?.latitude).toBeUndefined();

    await pressChip(tree, t('directory.nearby'));
    expect(lastQuery()).toEqual(
      expect.objectContaining({ latitude: 41.3, longitude: 69.25, radiusKm: 25 }),
    );
  });

  it('does not ask again when permission was already granted', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as never);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 41.3, longitude: 69.25 },
    } as never);

    const tree = await render();
    await press(tree, t('directory.filters'));
    await pressChip(tree, t('directory.nearby'));

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(lastQuery()?.radiusKm).toBe(25);
  });

  it('says why nearby search is unavailable instead of returning nothing', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'undetermined',
    } as never);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);

    const tree = await render();
    await press(tree, t('directory.filters'));
    await pressChip(tree, t('directory.nearby'));

    expect(screenText(tree)).toContain(t('directory.nearbyDenied'));
    expect(lastQuery()?.latitude).toBeUndefined();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('changes the radius without asking for the position again', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as never);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 41.3, longitude: 69.25 },
    } as never);

    const tree = await render();
    await press(tree, t('directory.filters'));
    await pressChip(tree, t('directory.nearby'));
    await press(tree, t('directory.nearbyRadius', { km: 100 }));

    expect(lastQuery()?.radiusKm).toBe(100);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });
});
