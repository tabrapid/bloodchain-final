import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({ testTypeId: 'test-1', laboratoryId: 'lab-1' }),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockUseAvailableDates = jest.fn();
jest.mock('../hooks/useLaboratory', () => ({
  useLaboratoryAvailableDates: (...args: unknown[]) => mockUseAvailableDates(...args),
}));

import { createLocalization } from '@bloodchain/i18n';
import SelectLabDate from '../../app/(lab-booking)/date';

const { t } = createLocalization('en');

function dateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
/**
 * A bookable day inside the month the screen opens on. Clamped to the last of
 * the month so the suite does not start failing on the 29th: the grid only ever
 * draws the viewed month, so a day that spilled into the next one would be
 * "open" according to the fixture and absent from every cell.
 */
const openDay = new Date(
  Math.min(today.getTime() + 2 * 24 * 60 * 60 * 1000, endOfMonth.getTime()),
);

function availability(dates: Array<{ date: string; isAvailable: boolean }>) {
  return {
    data: {
      laboratoryId: 'lab-1',
      testTypeId: 'test-1',
      from: dateParam(today),
      to: dateParam(openDay),
      dates: dates.map((day) => ({
        date: day.date,
        totalSlots: day.isAvailable ? 3 : 0,
        availableSlots: day.isAvailable ? 3 : 0,
        isAvailable: day.isAvailable,
      })),
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  };
}

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
            <SelectLabDate />
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

/** Every day cell, identified by the accessibility label the screen gives it. */
function dayCells(tree: renderer.ReactTestRenderer) {
  // Host elements only: `findAll` would otherwise return the composite
  // `Pressable` and the `View` it renders as two hits for the same cell.
  return tree.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.props?.accessibilityRole === 'button' &&
      typeof node.props?.accessibilityLabel === 'string' &&
      typeof node.props?.accessibilityState?.selected === 'boolean',
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockUseAvailableDates.mockReset();
});

/**
 * S5-2: the laboratory date step.
 *
 * It used to be a flat list of the next twenty-one days with no availability on
 * it -- the donor picked a day, and only the next screen admitted it was
 * closed. These tests hold the two things that fixed: exactly one range request
 * (not one per visible day), and a grid where a closed day cannot be picked at
 * all.
 */
describe('laboratory date step', () => {
  it('asks for the whole visible month in a single range request', () => {
    mockUseAvailableDates.mockReturnValue(
      availability([{ date: dateParam(openDay), isAvailable: true }]),
    );

    render();

    expect(mockUseAvailableDates).toHaveBeenCalled();
    const [laboratoryId, testTypeId, from, to] = mockUseAvailableDates.mock.calls[0];
    expect(laboratoryId).toBe('lab-1');
    expect(testTypeId).toBe('test-1');
    // The window starts no earlier than today and ends on the last of the month.
    expect(from >= dateParam(today)).toBe(true);
    expect(to).toBe(dateParam(endOfMonth));

    // Every distinct set of arguments is one request; a per-day calendar would
    // have asked with a different `from`/`to` for each cell.
    const distinct = new Set(mockUseAvailableDates.mock.calls.map((call) => JSON.stringify(call)));
    expect(distinct.size).toBe(1);
  });

  it('enables only the days the range says are open', () => {
    mockUseAvailableDates.mockReturnValue(
      availability([{ date: dateParam(openDay), isAvailable: true }]),
    );

    const tree = render();
    const enabled = dayCells(tree).filter((cell) => !cell.props.accessibilityState.disabled);

    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.props.accessibilityLabel).toContain(String(openDay.getDate()));
  });

  it('says a closed day is unavailable rather than leaving it silently inert', () => {
    mockUseAvailableDates.mockReturnValue(
      availability([{ date: dateParam(openDay), isAvailable: true }]),
    );

    const tree = render();
    const disabled = dayCells(tree).filter((cell) => cell.props.accessibilityState.disabled);

    expect(disabled.length).toBeGreaterThan(0);
    for (const cell of disabled) {
      expect(cell.props.accessibilityLabel).toContain(t('booking.unavailableDay'));
    }
  });

  it('explains an empty month instead of showing a grid of grey cells', () => {
    mockUseAvailableDates.mockReturnValue(availability([]));

    const text = renderedText(render());

    expect(text).toContain(t('booking.noOpenDates'));
    expect(text).toContain(t('labBooking.noOpenDatesHint'));
    expect(text).not.toContain(t('booking.datesWithSlots'));
  });

  it('shows a loading state rather than an empty-looking month', () => {
    mockUseAvailableDates.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const tree = render();
    const text = renderedText(tree);

    expect(text).toContain(t('booking.loadingAvailability'));
    // Nothing is claimed to be open while the answer is still in flight.
    expect(dayCells(tree).every((cell) => cell.props.accessibilityState.disabled)).toBe(true);
  });

  it('offers a retry when the range request fails, instead of reading as "no dates"', () => {
    const refetch = jest.fn();
    mockUseAvailableDates.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
      isRefetching: false,
    });

    const text = renderedText(render());

    expect(text).toContain(t('labBooking.datesFailed'));
    expect(text).toContain(t('common.retry'));
  });
});
