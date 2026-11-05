import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';

/**
 * The location step, mounted against the shape the API actually sends.
 *
 * `organization-discovery.spec.tsx` mocks `src/api/geography` and
 * `src/api/organizations` at the module boundary, which is the right seam for
 * asking what the screen requests — but it means the unwrap those modules
 * perform (`apiRequest` ends in `return json.data`, with no fallback) is never
 * exercised. Sprint 2 shipped `/geography/*` and `GET /organizations/:id`
 * without the response envelope; every call evaluated to `undefined`, this
 * screen rendered an empty region picker, and nothing anywhere went red.
 *
 * So here nothing below the screen is mocked but `fetch` itself, and the
 * bodies it answers with are the enveloped ones the running application sends
 * — the same ones `apps/api/test/client-contract.e2e-spec.ts` asserts against
 * the live API, so a server that stops enveloping turns that suite red instead
 * of leaving this one passing against an assumption.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../auth/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getRefreshToken: jest.fn().mockResolvedValue('test-refresh-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
}));

import { useLocalSearchParams } from 'expo-router';

import SelectOrganization from '../../app/(booking)/organizations';
import { LocaleProvider } from '../i18n';

const REGION = {
  id: 'region-tk',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE',
  districtCount: 5,
};

const DISTRICT = {
  id: 'district-chilonzor',
  code: 'chilonzor',
  regionId: 'region-tk',
  nameUz: 'Chilonzor tumani',
  nameRu: 'Чиланзарский район',
  nameEn: 'Chilanzar District',
  source: 'DEMO',
};

const ORGANIZATION = {
  id: 'org-1',
  type: 'BLOOD_CENTER',
  name: 'Northstar Blood Center',
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
  isDemo: false,
  region: REGION,
  district: DISTRICT,
  services: [{ service: 'WHOLE_BLOOD_DONATION', note: null }],
  hours: [],
  distanceKm: 3.4,
};

const COVERAGE = {
  regions: { total: 14, official: 14, demo: 0 },
  districts: { total: 20, official: 0, demo: 20 },
  districtsAuthoritative: false,
  regionStandard: 'ISO 3166-2:UZ',
};

/** How the server answers each route this screen reads. */
type Enveloping = 'as-the-server-does' | 'bare';

function serve(mode: Enveloping) {
  (global.fetch as jest.Mock).mockImplementation((input: string) => {
    const url = new URL(input);
    const ok = (body: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    // `/organizations/discover` hand-writes `{ data, meta }` and carries no
    // interceptor either way, so it is the same in both modes -- which is
    // exactly why the empty picker was so hard to see: the list of centres
    // still arrived, only the filters above it were blank.
    if (url.pathname.endsWith('/organizations/discover')) {
      return ok({ data: [ORGANIZATION], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    }

    const payload = url.pathname.endsWith('/geography/regions')
      ? [REGION]
      : url.pathname.endsWith('/geography/districts')
        ? [DISTRICT]
        : url.pathname.endsWith('/geography/coverage')
          ? COVERAGE
          : { status: 'ok' };

    return ok(mode === 'as-the-server-does' ? { data: payload } : payload);
  });
}

const mounted: renderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  // `fetch` is the one seam this file mocks; the jest setup does not provide
  // it as a mock the way the api specs' own setup does.
  global.fetch = jest.fn() as unknown as typeof fetch;
  jest.mocked(useLocalSearchParams).mockReturnValue({ type: 'BLOOD_DONATION' } as never);
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

function screenText(tree: renderer.ReactTestRenderer): string {
  const strings: string[] = [];
  const walk = (node: renderer.ReactTestInstance) => {
    node.children.forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else walk(child);
    });
  };
  walk(tree.root);
  return strings.join(' ');
}

async function press(tree: renderer.ReactTestRenderer, label: string) {
  const target = tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .filter((node) => {
      const strings: string[] = [];
      const walk = (n: renderer.ReactTestInstance) => {
        n.children.forEach((child) => {
          if (typeof child === 'string') strings.push(child);
          else walk(child);
        });
      };
      walk(node);
      return strings.join(' ').includes(label);
    })
    .at(-1);
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
  await settle();
}

/**
 * A filter chip by the field it controls, not by the value it shows. Once a
 * region is chosen the chip reads "Tashkent City" and so does the card beneath
 * it, so matching on visible text finds the wrong node.
 */
/** The filters start collapsed, exactly as a donor first sees this screen. */
async function showFilters(tree: renderer.ReactTestRenderer) {
  const toggle = tree.root.findAll(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      node.props?.accessibilityLabel === 'Show filters',
    { deep: true },
  )[0];
  expect(toggle).toBeDefined();
  await act(async () => {
    toggle!.props.onPress();
  });
  await settle();
}

/**
 * Is `label` on offer as a choice, rather than merely somewhere on screen?
 *
 * "Tashkent City" is also the region printed on every organization card, so a
 * plain text search says yes even when the picker above it is empty -- which
 * is exactly the state Sprint 2 shipped and nobody noticed.
 */
function optionOffered(tree: renderer.ReactTestRenderer, label: string): boolean {
  return tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .some((node) => {
      const strings: string[] = [];
      const walk = (n: renderer.ReactTestInstance) => {
        n.children.forEach((child) => {
          if (typeof child === 'string') strings.push(child);
          else walk(child);
        });
      };
      walk(node);
      return strings.join(' ').trim() === label;
    });
}

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

describe('Location step, against the real response envelope', () => {
  it('fills the region picker from what the server sends', async () => {
    serve('as-the-server-does');

    const tree = await render();
    await showFilters(tree);
    await pressChip(tree, 'Region');

    expect(optionOffered(tree, 'Tashkent City')).toBe(true);
  });

  it('fills the district picker once a region is chosen', async () => {
    serve('as-the-server-does');

    const tree = await render();
    await showFilters(tree);
    await pressChip(tree, 'Region');
    await press(tree, 'Tashkent City');
    await pressChip(tree, 'District');

    expect(optionOffered(tree, 'Chilanzar District')).toBe(true);
  });

  it('warns that the districts on offer are demo data', async () => {
    serve('as-the-server-does');

    const tree = await render();
    await showFilters(tree);

    // `districtsAuthoritative: false` on the coverage route. The donor is told
    // the district list is not the official register before they filter by it.
    expect(screenText(tree)).toContain('District names are sample data');
  });

  it('lists the organizations the donor can walk into', async () => {
    serve('as-the-server-does');

    const tree = await render();

    expect(screenText(tree)).toContain('Northstar Blood Center');
  });

  // The negative control, and the reason this file exists. Serve these routes
  // the way Sprint 2 served them -- the payload bare, not under `data` -- and
  // the picker goes blank while the screen carries on as if nothing is wrong.
  // If a future change adds a client-side fallback that papers over a missing
  // envelope, this test fails and says so.
  it('goes blank when the server sends the payload unenveloped, silently', async () => {
    serve('bare');

    const tree = await render();
    await showFilters(tree);
    await pressChip(tree, 'Region');

    // The picker offers nothing but "Any region" ...
    expect(optionOffered(tree, 'Tashkent City')).toBe(false);
    // ... while the list of centres underneath is unaffected, which is what
    // made this so easy to miss: the screen looks like it is working.
    expect(screenText(tree)).toContain('Northstar Blood Center');
    // The demo-district warning is a flag off the coverage route, so it is
    // gone too -- the donor is no longer told the districts are samples.
    expect(screenText(tree)).not.toContain('District names are sample data');
    // No error state either: that is the whole problem with this failure mode.
    expect(screenText(tree).toLowerCase()).not.toContain('went wrong');
  });
});
