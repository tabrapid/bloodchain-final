import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, BookingStep, GlassCard } from '../../src/components';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/** How far ahead a donor may book a laboratory visit. */
const BOOKABLE_DAYS = 21;

function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Step 3: which day.
 *
 * The donation wizard's month grid shades the days that have open slots,
 * because `GET /appointments/availability` takes a date *range*.
 * `GET /laboratories/:id/slots` takes one day at a time, so the same grid here
 * would mean twenty-one requests to draw a month. Rather than pretend, this
 * offers the bookable window as plain days and the next step says honestly
 * when a day has no times left.
 */
export default function SelectLabDate() {
  const { t, formatWeekday, formatMonth } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ testTypeId: string; laboratoryId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: BOOKABLE_DAYS }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      return date;
    });
  }, []);

  return (
    <BookingStep
      step={3}
      title={t('labBooking.selectDateTitle')}
      subtitle={t('labBooking.selectDateSubtitle', { days: BOOKABLE_DAYS })}
      nextDisabled={!selected}
      onClose={() => router.replace('/(app)/laboratory')}
      onNext={() =>
        router.push({
          pathname: '/(lab-booking)/slot',
          params: {
            testTypeId: params.testTypeId,
            laboratoryId: params.laboratoryId,
            date: selected!,
          },
        })
      }
    >
      <GlassCard tier="elevated">
        <View style={styles.grid}>
          {days.map((date, index) => {
            const value = toDateParam(date);
            const isSelected = selected === value;
            return (
              <View key={value} style={styles.cell}>
                <Pressable
                  onPress={() => setSelected(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${formatWeekday(date, 'long')} ${date.getDate()} ${formatMonth(date, 'long')}`}
                  style={[styles.day, isSelected && styles.daySelected]}
                >
                  <AppText style={[styles.weekday, isSelected && styles.textSelected]}>
                    {index === 0 ? t('labBooking.today') : formatWeekday(date, 'short')}
                  </AppText>
                  <AppText style={[styles.dayNumber, isSelected && styles.textSelected]}>
                    {date.getDate()}
                  </AppText>
                  <AppText style={[styles.month, isSelected && styles.textSelected]}>
                    {formatMonth(date, 'short')}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -5,
    },
    cell: {
      width: `${100 / 4}%`,
      paddingHorizontal: 5,
      paddingBottom: 10,
    },
    day: {
      minHeight: 68,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.glass.standard.fill,
      borderWidth: 1,
      borderColor: colors.glass.standard.border,
    },
    daySelected: {
      backgroundColor: colors.primary,
      borderColor: 'transparent',
    },
    weekday: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    dayNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    month: {
      fontSize: 10,
      color: colors.textMuted,
    },
    textSelected: {
      color: colors.white,
    },
  });
}
