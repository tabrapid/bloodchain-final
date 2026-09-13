import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockUseMyAppointments = jest.fn();
jest.mock('../hooks/useAppointments', () => ({
  useMyAppointments: (...args: unknown[]) => mockUseMyAppointments(...args),
}));

import { createLocalization } from '@bloodchain/i18n';
import Calendar from '../../app/(app)/calendar';

// The grid labels each day the way the screen does -- through the shared
// formatter, so the assertion follows the locale instead of restating an
// English date format that localisation has since moved on from.
const { formatDate, t } = createLocalization('en');

const now = new Date();
/** The 1st of the month on screen -- in the past for most of the month. */
const earlyInMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0);

const appointment = {
  id: 'apt-1',
  referenceNumber: 'REF-1',
  appointmentType: 'BLOOD_DONATION',
  status: 'CONFIRMED',
  scheduledStart: earlyInMonth.toISOString(),
  scheduledEnd: new Date(earlyInMonth.getTime() + 3_600_000).toISOString(),
  organization: { id: 'org-1', name: 'City Blood Center' },
};

function render() {
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
            <Calendar />
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

beforeEach(() => {
  mockUseMyAppointments.mockReset();
  mockUseMyAppointments.mockReturnValue({ data: [appointment], isLoading: false });
});

describe('Calendar', () => {
  /**
   * The screen asked for `{ upcoming: true }`, so the grid could only ever dot
   * future days and every past date you tapped claimed you had nothing on --
   * in a calendar, where looking back is half of what it is for.
   */
  it('asks for every appointment, not only the upcoming ones', () => {
    render();

    const args = mockUseMyAppointments.mock.calls[0]?.[0];
    expect(args?.upcoming).toBeUndefined();
  });

  it('shows an appointment on a day that has already passed', () => {
    const tree = render();
    const label = `${formatDate(earlyInMonth, 'long')}, ${t('calendar.appointmentsCount', { count: 1 })}`;
    const cell = tree.root.find(
      (node) => (node.props as { accessibilityLabel?: string }).accessibilityLabel === label,
    );

    act(() => {
      (cell.props.onPress as () => void)();
    });

    expect(renderedText(tree)).toContain('City Blood Center');
  });

  it('offers a way to book from an empty day', () => {
    mockUseMyAppointments.mockReturnValue({ data: [], isLoading: false });

    expect(renderedText(render())).toContain('Schedule one');
  });
});
