import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type Locale } from '@bloodchain/i18n';
import { LocaleProvider, LOCALE_KEY } from '../i18n';
import { ThemeProvider } from '../theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'd-1' }),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockStored = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStored.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStored.delete(key);
  },
}));

const query = (data: unknown) => ({
  data,
  isPending: false,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

// A donation with every enum-bearing field populated: type, status and a
// cancellation reason, which are the three that used to reach the screen raw.
jest.mock('../hooks/useDonations', () => ({
  useDonation: () =>
    query({
      id: 'd-1',
      donationReference: 'DN-2026-0001',
      donationType: 'WHOLE_BLOOD',
      status: 'CANCELLED',
      cancellationReason: 'DONOR_CANCELLED',
      volumeMl: 450,
      bloodType: 'O',
      rhFactor: 'POSITIVE',
      createdAt: '2026-08-01T09:00:00.000Z',
      collectionCompletedAt: '2026-08-01T09:30:00.000Z',
      organization: { id: 'o-1', name: 'Toshkent qon markazi', address: 'Chilonzor 12' },
    }),
  useMyDonations: () => query({ data: [] }),
  useDonationStatistics: () => query(undefined),
}));

jest.mock('../hooks/useAppointments', () => ({
  useAppointment: () =>
    query({
      id: 'a-1',
      referenceNumber: 'AP-2026-0007',
      appointmentType: 'BLOOD_TEST',
      status: 'CONFIRMED',
      scheduledStart: '2026-10-01T09:00:00.000Z',
      scheduledEnd: '2026-10-01T09:30:00.000Z',
      organization: { id: 'o-1', name: 'Toshkent qon markazi', address: 'Chilonzor 12' },
      testType: { id: 't-1', name: 'Umumiy qon tahlili' },
    }),
  useCancelAppointment: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import DonationDetail from '../../app/(app)/donations/[id]';
import AppointmentDetail from '../../app/(app)/appointment/[id]';

const LANGUAGES: Locale[] = ['uz', 'ru', 'en'];

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderInLanguage(element: React.ReactNode, locale: Locale) {
  mockStored.set(LOCALE_KEY, locale);
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
              {element}
            </SafeAreaProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await settle();
  return tree;
}

/**
 * A database enum, as it looks when it reaches the glass: four or more capital
 * letters, optionally joined by underscores. `WHOLE_BLOOD`, `CANCELLED`,
 * `DONOR_CANCELLED`, `HEMATOLOGY`.
 *
 * Reference numbers (`DN-2026-0001`) do not match: the letter runs in them are
 * shorter than four. Blood groups (`O+`, `AB-`) do not either.
 */
const RAW_ENUM = /\b[A-Z]{4,}(?:_[A-Z]+)*\b/g;

/** A dotted catalogue path, which is what a missing key renders as. */
const RAW_KEY =
  /\b(?:common|units|medical|status|table|actions|appointment|donationHistory|labBooking|booking)\.[A-Za-z][A-Za-z.]*/g;

beforeEach(() => {
  mockStored.clear();
});

/**
 * S11 B8: a detail screen shows the record, not the column.
 *
 * Both of these printed enums straight through -- `{donation.status}` in a
 * badge, `donationType.replace('_', ' ')` as a heading, and the cancellation
 * reason the same way. Every one of them had a catalogue entry already.
 */
describe.each([
  ['Donation detail', () => <DonationDetail />],
  ['Appointment detail', () => <AppointmentDetail />],
])('%s', (_name, element) => {
  it.each(LANGUAGES)('shows no raw database enum in %s', async (locale) => {
    const tree = await renderInLanguage(element(), locale);
    const text = renderedText(tree);

    expect(text.match(RAW_ENUM) ?? []).toEqual([]);
    expect(text.match(RAW_KEY) ?? []).toEqual([]);

    act(() => tree.unmount());
  });
});
