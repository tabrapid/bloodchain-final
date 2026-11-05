import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useDesign } from '../useDesign';
import { fonts } from '../fonts';
import { hitTarget, radius, space } from '../tokens';
import { Text } from './Text';
import { IconButton } from './Button';

/** Seven dates that happen to be a Monday-to-Sunday week, for weekday names. */
const WEEKDAY_SAMPLE = Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 1 + index));

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Leading blanks before the 1st for a Monday-first week (getDay is Sunday-indexed). */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export interface MonthGridProps {
  year: number;
  month: number;
  /** The chosen day of this month, or null. */
  selectedDay?: number | null;
  /** Drawn with a ring. Pass the real today; the grid does not read the clock. */
  today?: Date;
  onSelectDay: (day: number) => void;
  /** A day that cannot be chosen — a past date, a day with no slots. */
  isDisabled?: (day: number) => boolean;
  /** Dots under a day: what is on it, in the caller's own colours. */
  renderMarkers?: (day: number) => ReactNode;
  /** Announced for a day. The caller formats the date in the reader's language. */
  dayAccessibilityLabel: (day: number) => string;
  /** Weekday initials, formatted by the caller's locale-aware formatter. */
  formatWeekday: (date: Date) => string;
  /** Month navigation. Omit `onPrevious` to fix the grid to one month. */
  monthLabel: string;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  previousDisabled?: boolean;
  /** A control beside the month name — "Today". */
  action?: ReactNode;
}

/**
 * A month of real dates.
 *
 * What it will not do is decide anything: which days are bookable, what the
 * dots under a day mean and how a date reads aloud are all the caller's, so
 * the grid cannot invent availability it has not been given.
 *
 * The month name sits at the left in the display face with the arrows
 * together at the right, the way every native calendar draws it; a centred
 * name between two arrows is a carousel, and a calendar is not one.
 */
export function MonthGrid({
  year,
  month,
  selectedDay = null,
  today,
  onSelectDay,
  isDisabled,
  renderMarkers,
  dayAccessibilityLabel,
  formatWeekday,
  monthLabel,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  previousDisabled = false,
  action,
}: MonthGridProps) {
  const { colors } = useDesign();

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks(year, month) }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1),
  ];

  const isToday = (day: number) =>
    Boolean(
      today &&
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year,
    );

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text variant="h3" accessibilityRole="header">
            {monthLabel}
          </Text>
          {action}
        </View>
        {onPrevious && previousLabel ? (
          <IconButton
            accessibilityLabel={previousLabel}
            onPress={onPrevious}
            disabled={previousDisabled}
            variant="surface"
            tone="secondary"
            icon={({ size, color }) => <ChevronLeft size={size} color={color} />}
          />
        ) : null}
        {onNext && nextLabel ? (
          <IconButton
            accessibilityLabel={nextLabel}
            onPress={onNext}
            variant="surface"
            tone="secondary"
            icon={({ size, color }) => <ChevronRight size={size} color={color} />}
          />
        ) : null}
      </View>

      {/* The weekday row is decoration: every cell below announces its own
          full date, so reading "M T W T F S S" first says nothing useful. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row' }}
      >
        {WEEKDAY_SAMPLE.map((day) => (
          <View key={day.getDay()} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="overline" tone="tertiary" caps>
              {formatWeekday(day)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`blank-${index}`} style={{ width: '14.28%', height: hitTarget.min }} />;
          }
          const disabled = isDisabled?.(day) ?? false;
          const selected = selectedDay === day;
          const current = isToday(day);
          return (
            <Pressable
              key={day}
              onPress={() => onSelectDay(day)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={dayAccessibilityLabel(day)}
              style={{ width: '14.28%', alignItems: 'center', paddingVertical: 2 }}
            >
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: current && !selected ? 1.5 : 0,
                      borderColor: colors.rose.base,
                      backgroundColor: selected
                        ? colors.rose.fill
                        : pressed
                          ? colors.surfacePressed
                          : 'transparent',
                      opacity: disabled ? 0.3 : 1,
                    }}
                  >
                    <Text
                      variant="body"
                      tone={selected ? 'onAccent' : current ? 'rose' : 'primary'}
                      style={{
                        fontFamily: selected || current ? fonts.semibold : fonts.regular,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 2 }}>
                    {renderMarkers?.(day)}
                  </View>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
