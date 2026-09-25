import { useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplet,
  FlaskConical,
  Plus,
  Stethoscope,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListGroup,
  ListRow,
  Row,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  hitTarget,
  iconSize,
  radius,
  space,
  useDesign,
  type AccentName,
  type StatusTone,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useMyAppointments } from '../../src/hooks/useAppointments';
import type { Appointment } from '../../src/api/appointments';
import { useTranslation } from '../../src/i18n';

/** Icon, label and accent per appointment type -- the legend reads from this too. */
const TYPES: Record<string, { labelKey: string; icon: LucideIcon; tone: AccentName }> = {
  BLOOD_DONATION: { labelKey: 'medical.appointmentTypes.bloodDonation', icon: Droplet, tone: 'rose' },
  BLOOD_TEST: { labelKey: 'medical.appointmentTypes.bloodTest', icon: FlaskConical, tone: 'clinical' },
  CONSULTATION: { labelKey: 'medical.appointmentTypes.consultation', icon: Stethoscope, tone: 'insight' },
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

/** What an appointment status means, as a badge tone. */
function statusTone(status: string): StatusTone {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'RESULT_PUBLISHED':
      return 'success';
    case 'PENDING':
    case 'RESULT_PENDING':
    case 'RESCHEDULED':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
    case 'EXPIRED':
      return 'critical';
    default:
      return 'neutral';
  }
}

/**
 * Calendar, rebuilt for V2.
 *
 * The grid was the one part of V1 that was already right -- a month of real
 * dates, one dot per appointment in its own type's colour, weekday names from
 * `Intl` rather than hardcoded English. It is kept, on V2 tokens, with bigger
 * targets: a day cell was a 13pt number in a circle inside a 14.28%-wide cell,
 * and on a 360dp phone that is a 44dp row split seven ways.
 *
 * What was wrong was underneath it. The appointment card printed
 * `{apt.status}` -- the raw enum, 'CONFIRMED', in capitals, in every language
 * -- and fell back to `appointmentType.replace('_', ' ')` for a type it did
 * not recognise, which is 'BLOOD DONATION' shouted at a Uzbek reader. Both are
 * catalogue lookups now: `status.appointment.*` has had all eleven values
 * since the status namespace shipped, and nothing was reading them.
 */
export default function Calendar() {
  const { colors } = useDesign();
  const { t, formatMonth, formatWeekday, formatDate, formatTime } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  // Every appointment, not just the upcoming ones. Filtered to upcoming, the
  // grid could only ever dot future days and any past date you tapped claimed
  // you had nothing on -- in a calendar, where looking back is half the point.
  const { data: appointments = [], isPending, isError, refetch, isRefetching } = useMyAppointments();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDayOfMonth = getFirstDayOfMonth(viewDate.year, viewDate.month);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
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

  const goToPreviousMonth = () =>
    setViewDate((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 },
    );

  const goToNextMonth = () =>
    setViewDate((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 },
    );

  const goToToday = () => {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(now);
  };

  const dayAppointments = (day: number) =>
    appointmentsByDate[new Date(viewDate.year, viewDate.month, day).toDateString()] ?? [];

  const isToday = (day: number) => day === today.getDate() && isViewingCurrentMonth;

  const isSelected = (day: number) =>
    day === selectedDate.getDate() &&
    viewDate.month === selectedDate.getMonth() &&
    viewDate.year === selectedDate.getFullYear();

  const typeOf = (type?: string) => TYPES[type ?? ''] ?? null;
  const typeColor = (type?: string) => {
    const entry = typeOf(type);
    return entry ? colors[entry.tone].base : colors.textTertiary;
  };

  return (
    <ScrollScreen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Stack gap="xl">
        <Row align="flex-start" gap="md" style={{ paddingTop: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h1">{t('calendar.title')}</Text>
            <Text variant="body" tone="secondary">
              {t('calendar.subtitle')}
            </Text>
          </View>
          <Button
            label={t('calendar.schedule')}
            size="md"
            block={false}
            accessibilityLabel={t('calendar.a11ySchedule')}
            icon={({ size, color }) => <Plus size={size} color={color} />}
            onPress={() => router.push('/(booking)/select-type')}
          />
        </Row>

        {/* ------------------------------------------------------ the month */}
        <Surface>
          <Stack gap="md">
            <Row gap="sm">
              <IconButton
                accessibilityLabel={t('calendar.a11yPreviousMonth')}
                onPress={goToPreviousMonth}
                icon={({ size, color }) => <ChevronLeft size={size} color={color} />}
              />
              <Row gap="sm" style={{ flex: 1, justifyContent: 'center' }}>
                <Text variant="h3" accessibilityRole="header">
                  {formatMonth(new Date(viewDate.year, viewDate.month, 1))}
                </Text>
                {/* Only when you have wandered off it -- a "today" button on
                    the month you are already looking at does nothing. */}
                {!isViewingCurrentMonth ? (
                  <Pressable
                    onPress={goToToday}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.a11yBackToToday')}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      minHeight: 28,
                      justifyContent: 'center',
                      paddingHorizontal: space.md,
                      borderRadius: radius.full,
                      backgroundColor: colors.rose.soft,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="caption" tone="rose">
                      {t('common.today')}
                    </Text>
                  </Pressable>
                ) : null}
              </Row>
              <IconButton
                accessibilityLabel={t('calendar.a11yNextMonth')}
                onPress={goToNextMonth}
                icon={({ size, color }) => <ChevronRight size={size} color={color} />}
              />
            </Row>

            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flexDirection: 'row' }}
            >
              {WEEKDAY_SAMPLE.map((day) => (
                <View key={day.getDay()} style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="overline" tone="tertiary" caps>
                    {formatWeekday(day, 'short')}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`blank-${index}`} style={{ width: '14.28%', height: hitTarget.min }} />;
                }
                const dayItems = dayAppointments(day);
                const selected = isSelected(day);
                const cellDate = new Date(viewDate.year, viewDate.month, day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDate(cellDate)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${formatDate(cellDate, 'long')}${
                      dayItems.length
                        ? `, ${t('calendar.appointmentsCount', { count: dayItems.length })}`
                        : ''
                    }`}
                    style={{ width: '14.28%', alignItems: 'center', paddingVertical: 2 }}
                  >
                    {({ pressed }) => (
                      <>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: radius.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: isToday(day) && !selected ? colors.rose.base : 'transparent',
                            backgroundColor: selected
                              ? colors.rose.fill
                              : pressed
                                ? colors.surfacePressed
                                : 'transparent',
                          }}
                        >
                          <Text
                            variant="label"
                            tone={selected ? 'onAccent' : isToday(day) ? 'rose' : 'primary'}
                          >
                            {day}
                          </Text>
                        </View>
                        {/* One dot per appointment, up to three, each in its
                            own type's colour -- a single dot said "something
                            today" and stopped there. */}
                        <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 3 }}>
                          {dayItems.slice(0, 3).map((apt) => (
                            <View
                              key={apt.id}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: typeColor(apt.appointmentType),
                              }}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Row gap="lg" style={{ justifyContent: 'center', paddingTop: space.sm }}>
              {Object.entries(TYPES).map(([type, entry]) => (
                <Row key={type} gap="xs">
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: colors[entry.tone].base,
                    }}
                  />
                  <Text variant="caption" tone="tertiary">
                    {t(entry.labelKey)}
                  </Text>
                </Row>
              ))}
            </Row>
          </Stack>
        </Surface>

        {/* --------------------------------------------- the day you picked */}
        <Stack gap="md">
          <SectionHeader title={formatDate(selectedDate, 'full')} />

          {isPending ? (
            <Surface>
              <Stack gap="md">
                <Skeleton height={16} width="60%" />
                <Skeleton height={16} width="40%" />
              </Stack>
            </Surface>
          ) : isError ? (
            // The month grid's dots and this list both come from one request,
            // so a failed one made an empty calendar rather than saying it had
            // failed.
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          ) : selectedDateAppointments.length === 0 ? (
            <EmptyState
              title={t('calendar.nothingBooked')}
              description={t('calendar.noAppointmentsOnDay')}
              icon={({ size, color }) => <CalendarDays size={size} color={color} />}
              action={{
                label: t('calendar.scheduleOne'),
                onPress: () => router.push('/(booking)/select-type'),
              }}
            />
          ) : (
            <ListGroup
              rows={selectedDateAppointments.map((apt) => {
                const entry = typeOf(apt.appointmentType);
                const Icon = entry?.icon ?? CalendarDays;
                const typeLabel = entry ? t(entry.labelKey) : t('calendar.appointment');
                return (
                  <ListRow
                    key={apt.id}
                    leading={<Icon size={iconSize.lg} color={typeColor(apt.appointmentType)} />}
                    title={`${formatTime(apt.scheduledStart)} · ${apt.organization.name}`}
                    subtitle={typeLabel}
                    trailing={
                      <Badge
                        label={t(`status.appointment.${apt.status}`)}
                        tone={statusTone(apt.status)}
                      />
                    }
                    accessibilityLabel={`${typeLabel}, ${formatTime(apt.scheduledStart)}, ${
                      apt.organization.name
                    }. ${t(`status.appointment.${apt.status}`)}`}
                    onPress={() => router.push(`/appointment/${apt.id}`)}
                  />
                );
              })}
            />
          )}
        </Stack>
      </Stack>
    </ScrollScreen>
  );
}
