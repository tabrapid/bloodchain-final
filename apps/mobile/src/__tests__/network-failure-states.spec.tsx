import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockMyAppointments = jest.fn();
jest.mock('../hooks/useAppointments', () => ({
  useMyAppointments: (...args: unknown[]) => mockMyAppointments(...args),
}));

const mockMyDonations = jest.fn();
const mockDonationStatistics = jest.fn();
jest.mock('../hooks/useDonations', () => ({
  useMyDonations: (...args: unknown[]) => mockMyDonations(...args),
  useDonationStatistics: (...args: unknown[]) => mockDonationStatistics(...args),
}));

import { createLocalization } from '@bloodchain/i18n';
import Calendar from '../../app/(app)/calendar';
import Donations from '../../app/(app)/donations';

const { t } = createLocalization('en');

function render(node: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <LocaleProvider>
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
          >
            {node}
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  return tree!;
}

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' | ');
}

const failed = {
  data: undefined,
  isLoading: false,
  isError: true,
  refetch: jest.fn(),
  isRefetching: false,
};

const empty = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  isRefetching: false,
};

beforeEach(() => {
  mockMyAppointments.mockReset();
  mockMyDonations.mockReset();
  mockDonationStatistics.mockReset().mockReturnValue({ data: undefined });
});

/**
 * S5: an unreachable server is not the same fact as an empty account.
 *
 * Both screens used to render their "you have nothing yet" card when the
 * request failed -- reassuring, wrong, and with no way to retry. These check
 * that the two states are now distinguishable on screen.
 */
describe('a failed request does not read as "you have none"', () => {
  it('Calendar says the request failed and offers a retry', () => {
    mockMyAppointments.mockReturnValue(failed);

    const text = renderedText(render(<Calendar />));

    expect(text).toContain(t('common.errorTitle'));
    expect(text).toContain(t('common.retry'));
    expect(text).not.toContain(t('calendar.nothingBooked'));
  });

  it('Calendar still says "nothing booked" when the day really is empty', () => {
    mockMyAppointments.mockReturnValue(empty);

    const text = renderedText(render(<Calendar />));

    expect(text).toContain(t('calendar.nothingBooked'));
    expect(text).not.toContain(t('common.errorTitle'));
  });

  it('Donation history says the request failed and offers a retry', () => {
    mockMyDonations.mockReturnValue(failed);

    const text = renderedText(render(<Donations />));

    expect(text).toContain(t('common.errorTitle'));
    expect(text).toContain(t('common.retry'));
    expect(text).not.toContain(t('donationHistory.empty'));
  });

  it('Donation history still says "no donations yet" for an account with none', () => {
    mockMyDonations.mockReturnValue({ ...empty, data: { data: [], meta: {} } });

    const text = renderedText(render(<Donations />));

    expect(text).toContain(t('donationHistory.empty'));
    expect(text).not.toContain(t('common.errorTitle'));
  });
});
