import { useState, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen } from '../../src/components';
import { useAvailability } from '../../src/hooks/useAppointments';
import { spacing, useTheme, ThemeColors } from '../../src/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
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
    startDate: new Date(year, month, 1).toISOString().split('T')[0],
    endDate: new Date(year, month + 1, 0).toISOString().split('T')[0],
  });

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    availableSlots.forEach((slot) => {
      const date = new Date(slot.startAt).toDateString();
      dates.add(date);
    });
    return dates;
  }, [availableSlots]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [daysInMonth, firstDayOfMonth]);

  const goToPreviousMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(year, month, day);
    router.push({
      pathname: '/(booking)/time',
      params: {
        organizationId: params.organizationId,
        type: params.type,
        date: selectedDate.toISOString().split('T')[0],
        ...(params.rescheduleAppointmentId && {
          rescheduleAppointmentId: params.rescheduleAppointmentId,
        }),
      },
    });
  };

  const hasAvailability = (day: number) => {
    const date = new Date(year, month, day).toDateString();
    return availableDates.has(date);
  };

  const canGoNext = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextMonth = new Date(year, month + 1, 1);
    return nextMonth >= today;
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          {params.rescheduleAppointmentId ? 'Reschedule Appointment' : 'Select Date'}
        </AppText>
        <AppText muted style={styles.subtitle}>
          {params.rescheduleAppointmentId
            ? 'Choose a new date for your appointment.'
            : 'Choose a date for your appointment.'}
        </AppText>

        {isLoading && (
          <AppText muted style={styles.statusText}>
            Loading availability...
          </AppText>
        )}

        {isError && (
          <Card style={styles.errorCard}>
            <AppText style={{ color: colors.danger }}>
              Couldn't load availability. Check your connection and try again.
            </AppText>
            <AppButton
              variant="secondary"
              onPress={() => refetch()}
              disabled={isRefetching}
              style={styles.retryButton}
            >
              {isRefetching ? 'Retrying...' : 'Retry'}
            </AppButton>
          </Card>
        )}

        <GlassCard style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <AppText variant="heading">
              {MONTHS[month]} {year}
            </AppText>
            <TouchableOpacity
              onPress={goToNextMonth}
              style={styles.navButton}
              disabled={!canGoNext()}
            >
              <ChevronRight
                size={20}
                color={canGoNext() ? colors.text : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.weekdayCell}>
                <AppText muted style={styles.weekdayText}>
                  {day}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((day, index) => {
              const hasSlots = day && hasAvailability(day);
              const isPast = day
                ? new Date(year, month, day) < new Date(new Date().setHours(0, 0, 0, 0))
                : false;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.dayCell}
                  onPress={() => day && hasSlots && !isPast && handleDateSelect(day)}
                  disabled={!day || !hasSlots || isPast}
                >
                  {day && (
                    <View
                      style={[
                        styles.dayCircle,
                        !hasSlots && styles.dayDisabled,
                        isPast && styles.dayDisabled,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.dayText,
                          !hasSlots && styles.dayTextDisabled,
                          isPast && styles.dayTextDisabled,
                        ]}
                      >
                        {day}
                      </AppText>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        <Card style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <AppText muted style={styles.legendText}>
              Available dates
            </AppText>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton variant="secondary" onPress={() => router.back()}>
          Back
        </AppButton>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.xl,
    },
    title: {
      marginBottom: spacing.xs,
    },
    subtitle: {
      marginBottom: spacing.xl,
    },
    statusText: {
      marginBottom: spacing.md,
    },
    errorCard: {
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    retryButton: {
      marginTop: spacing.md,
      alignSelf: 'center',
    },
    calendarCard: {
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    monthNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    navButton: {
      padding: spacing.sm,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
    },
    dayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successMuted,
    },
    dayDisabled: {
      backgroundColor: colors.surfaceElevated,
    },
    dayText: {
      fontSize: 14,
      color: colors.onMuted.success,
    },
    dayTextDisabled: {
      color: colors.textMuted,
    },
    legendCard: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 13,
    },
    footer: {
      paddingTop: spacing.lg,
    },
  });
}