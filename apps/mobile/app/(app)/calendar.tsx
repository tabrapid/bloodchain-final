import { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { AppText, Card, EmptyState, GlassCard, Screen } from '../../src/components';
import { useMyAppointments } from '../../src/hooks/useAppointments';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';

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

export default function Calendar() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  const { data: appointments = [], isLoading } = useMyAppointments({ upcoming: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDayOfMonth = getFirstDayOfMonth(viewDate.year, viewDate.month);

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

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, typeof appointments> = {};
    appointments.forEach((apt) => {
      const date = new Date(apt.scheduledStart).toDateString();
      if (!map[date]) map[date] = [];
      map[date].push(apt);
    });
    return map;
  }, [appointments]);

  const selectedDateStr = selectedDate.toDateString();
  const selectedDateAppointments = appointmentsByDate[selectedDateStr] || [];

  const goToPreviousMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setViewDate({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(today);
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.year, viewDate.month, day);
    setSelectedDate(newDate);
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      viewDate.month === today.getMonth() &&
      viewDate.year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      viewDate.month === selectedDate.getMonth() &&
      viewDate.year === selectedDate.getFullYear()
    );
  };

  const hasAppointment = (day: number) => {
    const date = new Date(viewDate.year, viewDate.month, day);
    return !!appointmentsByDate[date.toDateString()];
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return colors.success;
      case 'PENDING':
        return colors.warning;
      case 'CANCELLED':
        return colors.danger;
      default:
        return colors.textMuted;
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Calendar</AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <AppText style={styles.todayText}>Today</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(booking)/select-type')} style={styles.bookButton}>
            <Plus size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <GlassCard style={styles.calendarCard}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="heading">
            {MONTHS[viewDate.month]} {viewDate.year}
          </AppText>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <ChevronRight size={20} color={colors.text} />
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
          {calendarDays.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                day && hasAppointment(day) && styles.dayWithAppointment,
              ]}
              onPress={() => day && handleDateSelect(day)}
              disabled={!day}
            >
              {day && (
                <>
                  <View
                    style={[
                      styles.dayCircle,
                      isToday(day) && styles.dayToday,
                      isSelected(day) && styles.daySelected,
                    ]}
                  >
                    <AppText
                      variant="body"
                      style={[
                        styles.dayText,
                        isToday(day) && styles.dayTextToday,
                        isSelected(day) && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </AppText>
                  </View>
                  {hasAppointment(day) && <View style={styles.appointmentDot} />}
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      <ScrollView style={styles.appointmentsSection}>
        <AppText variant="heading" style={styles.selectedDateTitle}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </AppText>

        {isLoading ? (
          <AppText muted>Loading...</AppText>
        ) : selectedDateAppointments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title="No appointments"
              description="No appointments scheduled for this day."
            />
          </Card>
        ) : (
          selectedDateAppointments.map((apt) => (
            <TouchableOpacity
              key={apt.id}
              onPress={() => router.push(`/appointment/${apt.id}`)}
            >
              <Card style={styles.appointmentCard}>
                <View style={styles.appointmentTime}>
                  <AppText variant="heading">
                    {formatTime(apt.scheduledStart)}
                  </AppText>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(apt.status) + '20' },
                    ]}
                  >
                    <AppText
                      style={[styles.statusText, { color: getStatusColor(apt.status) }]}
                    >
                      {apt.status}
                    </AppText>
                  </View>
                </View>
                <AppText>{apt.organization.name}</AppText>
                <AppText muted style={styles.appointmentType}>
                  {apt.appointmentType.replace('_', ' ')}
                </AppText>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    todayButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceSolid,
      borderRadius: radius.sm,
    },
    todayText: {
      color: colors.primary,
      fontWeight: '600',
    },
    bookButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
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
    dayWithAppointment: {},
    dayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayToday: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
    daySelected: {
      backgroundColor: colors.primary,
    },
    dayText: {
      fontSize: 14,
    },
    dayTextToday: {
      color: colors.primary,
    },
    dayTextSelected: {
      color: colors.white,
    },
    appointmentDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 2,
    },
    appointmentsSection: {
      flex: 1,
    },
    selectedDateTitle: {
      marginBottom: spacing.md,
    },
    emptyCard: {
      paddingVertical: spacing.xl,
    },
    appointmentCard: {
      marginBottom: spacing.md,
    },
    appointmentTime: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    appointmentType: {
      fontSize: 13,
      marginTop: 2,
      textTransform: 'capitalize',
    },
  });
}