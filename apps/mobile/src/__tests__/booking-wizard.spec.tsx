import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';

/**
 * The booking wizard is the flow that produces the app's core artifact -- an
 * appointment -- and it spans five routes, each of which hands the next one
 * the parameters it needs through the URL. Nothing held that contract: a
 * renamed param or a dropped `rescheduleAppointmentId` would type-check
 * cleanly and only fail on a device, at the step that silently books the
 * wrong thing.
 *
 * So these tests walk the real screens and assert what each step navigates
 * with, plus the two rules the shared chrome enforces: you cannot advance
 * without choosing, and closing the wizard leaves it entirely rather than
 * stepping back into it.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
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
jest.mock('../api/appointments', () => ({
  getAvailability: jest.fn(),
  getMyAppointments: jest.fn(),
  getAppointment: jest.fn(),
  bookAppointment: jest.fn(),
  cancelAppointment: jest.fn(),
  rescheduleAppointment: jest.fn(),
}));

import { router, useLocalSearchParams } from 'expo-router';
import { getAvailability } from '../api/appointments';
import { discoverOrganizations, getOrganization } from '../api/organizations';
import { getDistricts, getGeographyCoverage, getRegions } from '../api/geography';

import SelectType from '../../app/(booking)/select-type';
import SelectOrganization from '../../app/(booking)/organizations';
import SelectTime from '../../app/(booking)/time';
import { LocaleProvider } from '../i18n';
import { createLocalization } from '@bloodchain/i18n';

/**
 * The screens' own words, looked up the way the screens look them up, so a
 * catalogue rewording moves the assertion with it instead of breaking it.
 */
const { t } = createLocalization('en');

const organization = {
  id: 'org-1',
  type: 'BLOOD_CENTER',
  name: 'Central Blood Center',
  address: '1 Main St',
  directionsNote: null,
  publicPhone: null,
  phone: null,
  latitude: null,
  longitude: null,
  status: 'ACTIVE',
  acceptsDonations: true,
  providesLaboratory: true,
  isVerified: true,
  isDemo: false,
  region: null,
  district: null,
  services: [],
  hours: [],
  distanceKm: null,
};

const region = {
  id: 'region-1',
  code: 'UZ-TK',
  nameUz: 'Toshkent shahri',
  nameRu: 'город Ташкент',
  nameEn: 'Tashkent City',
  centerEn: 'Tashkent',
  source: 'OFFICIAL_REFERENCE',
  districtCount: 2,
};

const slot = {
  id: 'slot-1',
  organizationId: 'org-1',
  organization,
  appointmentType: 'BLOOD_DONATION',
  startAt: '2026-09-10T09:30:00.000Z',
  endAt: '2026-09-10T10:15:00.000Z',
  capacity: 5,
  availableSpots: 5,
  status: 'AVAILABLE',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({} as never);
  jest.mocked(discoverOrganizations).mockResolvedValue({
    organizations: [organization],
    total: 1,
    totalPages: 1,
  } as never);
  jest.mocked(getOrganization).mockResolvedValue(organization as never);
  jest.mocked(getRegions).mockResolvedValue([region] as never);
  jest.mocked(getDistricts).mockResolvedValue([] as never);
  jest.mocked(getGeographyCoverage).mockResolvedValue({
    regions: { total: 1, official: 1, demo: 0 },
    districts: { total: 2, official: 0, demo: 2 },
    districtsAuthoritative: false,
    regionStandard: 'ISO 3166-2:UZ',
  } as never);
  jest.mocked(getAvailability).mockResolvedValue([slot] as never);
});

/** Mounted trees, unmounted after each test so their effects stop running. */
const mounted: renderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

async function render(element: React.ReactElement) {
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
            {element}
          </SafeAreaProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);

  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return tree;
}

/** Every string rendered anywhere beneath a test instance. */
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

/** The innermost pressable whose own subtree renders `label`. */
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
}

/** The wizard's single primary action, wherever it is in the tree. */
function continueButton(tree: renderer.ReactTestRenderer, label = 'Continue') {
  return pressableWithText(tree, label)!;
}

describe('Booking wizard: what each step hands the next', () => {
  it('will not advance from step 1 until a type is chosen', async () => {
    const tree = await render(<SelectType />);

    expect(continueButton(tree).props.disabled).toBe(true);

    await press(tree, t('appointmentTypes.BLOOD_DONATION'));

    expect(continueButton(tree).props.disabled).toBeFalsy();
    await press(tree, t('common.continue'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(booking)/organizations',
      params: { type: 'BLOOD_DONATION' },
    });
  });

  it('carries the appointment type into the location step', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ type: 'BLOOD_TEST' } as never);
    const tree = await render(<SelectOrganization />);

    // The location step asks for a capability, not an organization type: a
    // lab test needs somewhere that runs laboratory testing, and sending
    // "BLOOD_TEST" as `type` asks for an organization type that does not exist.
    expect(discoverOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({ providesLaboratory: true }),
    );
    expect(discoverOrganizations).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BLOOD_TEST' }),
    );
    expect(continueButton(tree).props.disabled).toBe(true);

    await press(tree, organization.name);
    await press(tree, t('common.continue'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(booking)/date',
      params: { organizationId: 'org-1', type: 'BLOOD_TEST' },
    });
  });

  it('preserves the reschedule target all the way to review', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({
      organizationId: 'org-1',
      type: 'BLOOD_DONATION',
      date: '2026-09-10',
      rescheduleAppointmentId: 'appointment-9',
    } as never);

    const tree = await render(<SelectTime />);

    const slotLabel = new Date(slot.startAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    await press(tree, slotLabel);
    await press(tree, t('common.continue'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(booking)/review',
      params: {
        slotId: 'slot-1',
        organizationId: 'org-1',
        type: 'BLOOD_DONATION',
        date: '2026-09-10',
        // Dropping this is what would silently turn a reschedule into a
        // second, duplicate booking.
        rescheduleAppointmentId: 'appointment-9',
      },
    });
  });

  it('closes out of the wizard rather than stepping back through it', async () => {
    const tree = await render(<SelectType />);

    const close = tree.root.find(
      (node) => node.props?.accessibilityLabel === 'Close booking',
    );
    await act(async () => {
      close.props.onPress();
    });

    expect(router.replace).toHaveBeenCalledWith('/(app)/donate');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('offers no Back link on the first step', async () => {
    const tree = await render(<SelectType />);

    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === 'Go back'),
    ).toHaveLength(0);
  });
});
