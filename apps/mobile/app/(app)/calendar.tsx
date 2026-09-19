import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Droplet, FlaskConical, Plus, Stethoscope } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Card,
  ErrorState,
  GlassCard,
  Screen,
  SectionHeader,
} from '../../src/components';
import { LucideIcon } from '../../src/types/icons';
import { useMyAppointments } from '../../src/hooks/useAppointments';
import type { Appointment } from '../../src/api/appointments';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/** Icon, label and colour key per appointment type -- the legend reads from this too. */
const TYPES: Record<string, { labelKey: string; icon: LucideIcon; color: 'primary' | 'secondary' | 'ai' }> = {
  BLOOD_DONATION: { labelKey: 'medical.appointmentTypes.bloodDonation', icon: Droplet, color: 'primary' },
  BLOOD_TEST: { labelKey: 'medical.appointmentTypes.bloodTest', icon: FlaskConical, color: 'secondary' },
  CONSULTATION: { labelKey: 'medical.appointmentTypes.consultation', icon: Stethoscope, color: 'ai' },
};

/**
 * Seven dates that happen to be a Monday-to-Sunday week.
 *
 * Used only to ask `Intl` for weekday names in the reader's language; January
 * 2024 opens on a Monday, which is the whole reason these particular dates.
 * Hardcoding 'Mon' … 'Sun' would have left the grid in English in every
 * language, above days numbered in the reader's own.
 */
const WEEKDAY_SAMPLE = Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 1 + index));

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Leading blank cells before the 1st, for a week that starts on Monday.
 * `getDay()` is Sunday-indexed, so Sunday (0) has to wrap to the end.
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export default function Calendar() {
  const { colors } = useTheme();
  const { t, formatMonth, formatWeekday, formatDate, formatTime } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  // Every appointment, not just the upcoming ones. Filtered to upcoming, the
  // grid could only ever dot future days and any past date you tapped claimed
  // you had nothing on -- in a calendar, where looking back is half the point.
  const { data: appointments = [], isLoading, isError, refetch } = useMyAppointments();

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
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      const date = new Date(apt.scheduledStart).toDateString();
      if (!map[date]) map[date] = [];
      map[date]!.push(apt);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    );
    return map;
  }, [appointments]);

  const selectedDateAppointments = appointmentsByDate[selectedDate.toDateString()] ?? [];
  const isViewingCurrentMonth =
    viewDate.month === today.getMonth() && viewDate.year === today.getFullYear();

  const goToPreviousMonth = () => {
    setViewDate((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 },
    );
  };

  const goToNextMonth = () => {
    setViewDate((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 },
    );
  };

  const goToToday = () => {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(now);
  };

  const dayAppointments = (day: number) =>
    appointmentsByDate[new Date(viewDate.year, viewDate.month, day).toDateString()] ?? [];

  const isToday = (day: number) =>
    day === today.getDate() && isViewingCurrentMonth;

  const isSelected = (day: number) =>
    day === selectedDate.getDate() &&
    viewDate.month === selectedDate.getMonth() &&
    viewDate.year === selectedDate.getFullYear();

  const typeOf = (type?: string) => TYPES[type ?? ''] ?? null;
  const typeColor = (type?: string) => {
    const entry = typeOf(type);
    return entry ? colors[entry.color] : colors.textMuted;
  };

  const statusTone = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return { fill: colors.successMuted, text: colors.onMuted.success, dot: colors.success };
      case 'PENDING':
        return { fill: colors.warningMuted, text: colors.onMuted.warning, dot: colors.warning };
      case 'CANCELLED':
        return { fill: colors.dangerMuted, text: colors.onMuted.danger, dot: colors.danger };
      default:
        return { fill: colors.surfaceElevated, text: colors.textMuted, dot: colors.textMuted };
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.title}>{t('calendar.title')}</AppText>
          <AppText muted style={styles.headerSubtitle}>
            {t('calendar.subtitle')}
          </AppText>
        </View>
        <AppButton
          gradient
          size="small"
          onPress={() => router.push('/(booking)/select-type')}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.a11ySchedule')}
          style={styles.bookButton}
        >
          <Plus size={16} color={colors.white} />
          {t('calendar.schedule')}
        </AppButton>
      </View>

      <GlassCard tier="elevated" style={styles.calendarCard}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={goToPreviousMonth}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.a11yPreviousMonth')}
            hitSlop={8}
            style={styles.navButton}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <View style={styles.monthLabelGroup}>
            <AppText style={styles.monthLabel}>
              {formatMonth(new Date(viewDate.year, viewDate.month, 1))}
            </AppText>
            {/* Only when you have wandered off it -- a t('common.today') button on the
                month you are already looking at is a button that does nothing. */}
            {!isViewingCurrentMonth && (
              <Pressable
                onPress={goToToday}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.a11yBackToToday')}
                hitSlop={6}
                style={styles.todayChip}
              >
                <AppText style={styles.todayText}>{t('common.today')}</AppText>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={goToNextMonth}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.a11yNextMonth')}
            hitSlop={8}
            style={styles.navButton}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_SAMPLE.map((day) => (
            <View key={day.getDay()} style={styles.weekdayCell}>
              <AppText muted style={styles.weekdayText}>
                {formatWeekday(day, 'short')}
              </AppText>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((day, index) => {
            if (!day) {
              return <View key={`blank-${index}`} style={styles.dayCell} />;
            }
            const dayItems = dayAppointments(day);
            const selected = isSelected(day);
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDate(new Date(viewDate.year, viewDate.month, day))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${formatDate(
                  new Date(viewDate.year, viewDate.month, day),
                  'long',
                )}${dayItems.length ? `, ${t('calendar.appointmentsCount', { count: dayItems.length })}` : ''}`}
                style={styles.dayCell}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday(day) && styles.dayToday,
                    selected && styles.daySelected,
                  ]}
                >
                  <AppText
                    style={[
                      styles.dayText,
                      isToday(day) && styles.dayTextToday,
                      selected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </AppText>
                </View>
                {/* One dot per appointment, up to three, each in its own
                    type's colour -- a single dot said "something today" and
                    stopped there. */}
                <View style={styles.dotRow}>
                  {dayItems.slice(0, 3).map((apt) => (
                    <View
                      key={apt.id}
                      style={[styles.appointmentDot, { backgroundColor: typeColor(apt.appointmentType) }]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          {Object.entries(TYPES).map(([type, entry]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors[entry.color] }]} />
              <AppText muted style={styles.legendLabel}>
                {t(entry.labelKey)}
              </AppText>
            </View>
          ))}
        </View>
      </GlassCard>

      <SectionHeader>
        {formatDate(selectedDate, 'full')}
      </SectionHeader>

      {isLoading ? (
        <AppText muted>{t('common.loading')}</AppText>
      ) : isError ? (
        // The month grid dots and this list both come from one request, so a
        // failed one made an empty calendar rather than saying it had failed.
        <ErrorState onRetry={() => void refetch()} />
      ) : selectedDateAppointments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <CalendarDays size={22} color={colors.textMuted} />
          </View>
          <AppText style={styles.emptyTitle}>{t('calendar.nothingBooked')}</AppText>
          <AppText muted style={styles.emptyNote}>
            {t('calendar.noAppointmentsOnDay')}
          </AppText>
          <AppButton
            variant="secondary"
            size="small"
            onPress={() => router.push('/(booking)/select-type')}
            style={styles.emptyAction}
          >
            {t('calendar.scheduleOne')}
          </AppButton>
        </Card>
      ) : (
        selectedDateAppointments.map((apt) => {
          const entry = typeOf(apt.appointmentType);
          const Icon = entry?.icon ?? CalendarDays;
          const accent = typeColor(apt.appointmentType);
          const tone = statusTone(apt.status);
          return (
            <Pressable
              key={apt.id}
              onPress={() => router.push(`/appointment/${apt.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${entry ? t(entry.labelKey) : t('calendar.appointment')} · ${formatTime(apt.scheduledStart)}, ${apt.organization.name}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={styles.appointmentCard}>
                <View style={styles.appointmentRow}>
                  <View style={[styles.appointmentIcon, { backgroundColor: `${accent}26` }]}>
                    <Icon size={20} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.appointmentTitleRow}>
                      <AppText style={styles.appointmentTime}>
                        {formatTime(apt.scheduledStart)}
                      </AppText>
                      <View style={[styles.statusBadge, { backgroundColor: tone.fill }]}>
                        <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                        <AppText style={[styles.statusText, { color: tone.text }]}>
                          {apt.status}
                        </AppText>
                      </View>
                    </View>
                    <AppText style={styles.appointmentOrg} numberOfLines={1}>
                      {apt.organization.name}
                    </AppText>
                    <AppText muted style={styles.appointmentType}>
                      {entry ? t(entry.labelKey) : apt.appointmentType.replace('_', ' ')}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -1,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      marginTop: 2,
    },
    bookButton: {
      paddingHorizontal: spacing.md,
      marginTop: 4,
    },
    calendarCard: {
      marginBottom: layout.cardGap,
    },
    monthNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    monthLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    monthLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    todayChip: {
      minHeight: 26,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: `${colors.onMuted.primary}33`,
    },
    todayText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onMuted.primary,
    },
    navButton: {
      padding: spacing.sm,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: 2,
    },
    dayCircle: {
      width: '86%',
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayToday: {
      backgroundColor: `${colors.primary}1F`,
      borderColor: `${colors.primary}66`,
    },
    daySelected: {
      backgroundColor: colors.primary,
    },
    dayText: {
      fontSize: 13,
      fontWeight: '600',
    },
    dayTextToday: {
      color: colors.primary,
    },
    dayTextSelected: {
      color: colors.white,
    },
    dotRow: {
      flexDirection: 'row',
      gap: 2,
      height: 6,
      marginTop: 3,
    },
    appointmentDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: 11,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginTop: spacing.sm,
      color: colors.text,
    },
    emptyNote: {
      fontSize: 13,
      marginTop: 2,
      textAlign: 'center',
    },
    emptyAction: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    appointmentCard: {
      marginBottom: layout.cardGap,
    },
    appointmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    appointmentIcon: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    appointmentTime: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    appointmentOrg: {
      fontSize: 14,
      fontWeight: '500',
      marginTop: 3,
    },
    appointmentType: {
      fontSize: 12,
      marginTop: 1,
    },
  });
}
