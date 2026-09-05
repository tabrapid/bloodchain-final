import { useState, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppButton, AppText, BookingStep, GlassCard } from '../../src/components';
import { useAvailability } from '../../src/hooks/useAppointments';
import { layout, spacing, useTheme, ThemeColors } from '../../src/theme';

/** Monday-first, matching the reference and the app's own Calendar screen. */
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Weekday index of the 1st, shifted so Monday is 0. */
function getFirstWeekdayIndex(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export default function SelectDate() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    organizationId: string;
    type: string;
    rescheduleAppointmentId?: string;
  }>();

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const {
    data: availableSlots = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useAvailability({
    organizationId: params.organizationId,
    appointmentType: params.type,
    startDate: toDateParam(new Date(year, month, 1)),
    endDate: toDateParam(new Date(year, month + 1, 0)),
  });

  const availableDates = useMemo(
    () => new Set(availableSlots.map((slot) => new Date(slot.startAt).toDateString())),
    [availableSlots],
  );

  const calendarDays = useMemo(() => {
    const leading = getFirstWeekdayIndex(year, month);
    const days: (number | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= getDaysInMonth(year, month); day++) days.push(day);
    return days;
  }, [year, month]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const changeMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
    setSelectedDay(null);
  };

  // The month grid only ever shows dates from the currently viewed month, so
  // stepping back is only useful while that month can still contain a
  // bookable day.
  const canGoBack = new Date(year, month, 1) > today;

  const isBookable = (day: number) =>
    availableDates.has(new Date(year, month, day).toDateString()) &&
    new Date(year, month, day) >= today;

  return (
    <BookingStep
      step={3}
      title={params.rescheduleAppointmentId ? 'Pick a new date' : 'Select date'}
      subtitle="Only dates with open slots can be picked"
      nextDisabled={selectedDay === null}
      onNext={() =>
        router.push({
          pathname: '/(booking)/time',
          params: {
            organizationId: params.organizationId,
            type: params.type,
            date: toDateParam(new Date(year, month, selectedDay!)),
            ...(params.rescheduleAppointmentId && {
              rescheduleAppointmentId: params.rescheduleAppointmentId,
            }),
          },
        })
      }
    >
      {isError && (
        <GlassCard danger style={styles.errorCard}>
          <AppText style={styles.errorText}>
            Couldn&apos;t load availability. Check your connection and try again.
          </AppText>
          <AppButton
            variant="secondary"
            onPress={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            style={styles.retry}
          >
            Retry
          </AppButton>
        </GlassCard>
      )}

      <GlassCard tier="elevated">
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => changeMonth(-1)}
            disabled={!canGoBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.navButton}
          >
            <ChevronLeft size={20} color={canGoBack ? colors.text : colors.textSubtle} />
          </Pressable>
          <AppText style={styles.monthLabel}>
            {MONTHS[month]} {year}
          </AppText>
          <Pressable
            onPress={() => changeMonth(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.navButton}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_INITIALS.map((initial, index) => (
            <View key={`${initial}-${index}`} style={styles.cell}>
              <AppText style={styles.weekdayText}>{initial}</AppText>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {calendarDays.map((day, index) => {
            if (day === null) return <View key={`pad-${index}`} style={styles.cell} />;
            const bookable = isBookable(day);
            const selected = selectedDay === day;
            return (
              <View key={day} style={styles.cell}>
                <Pressable
                  onPress={() => setSelectedDay(day)}
                  disabled={!bookable}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !bookable }}
                  accessibilityLabel={`${MONTHS[month]} ${day}${bookable ? '' : ', unavailable'}`}
                  style={[
                    styles.day,
                    bookable && styles.dayAvailable,
                    selected && styles.daySelected,
                  ]}
                >
                  <AppText
                    style={[
                      styles.dayText,
                      !bookable && styles.dayTextMuted,
                      selected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <View style={styles.legend}>
        <View style={styles.legendSwatch} />
        <AppText style={styles.legendText}>
          {isLoading ? 'Loading availability…' : 'Dates with open slots'}
        </AppText>
      </View>
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorCard: {
      marginBottom: layout.cardGap,
    },
    errorText: {
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    retry: {
      marginTop: spacing.md,
      alignSelf: 'center',
    },

    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    navButton: {
      minWidth: 32,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    weekdayText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
    },
    day: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayAvailable: {
      backgroundColor: colors.successMuted,
    },
    daySelected: {
      backgroundColor: colors.primary,
    },
    dayText: {
      fontSize: 12,
      color: colors.text,
    },
    dayTextMuted: {
      color: colors.textSubtle,
    },
    dayTextSelected: {
      fontWeight: '700',
      color: colors.white,
    },

    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    legendSwatch: {
      width: 12,
      height: 12,
      borderRadius: 4,
      backgroundColor: colors.successMuted,
    },
    legendText: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
