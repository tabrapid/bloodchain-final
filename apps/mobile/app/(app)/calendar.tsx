import { useState, useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, Droplet, FlaskConical, Plus, Stethoscope } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListGroup,
  ListRow,
  MonthGrid,
  Row,
  ScreenTitle,
  ScrollScreen,
  Section,
  Sections,
  Skeleton,
  Surface,
  Text,
  iconSize,
  space,
  useDesign,
  type AccentName,
  type StatusTone,
  StatusDot,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useMyAppointments } from '../../src/hooks/useAppointments';
import type { Appointment } from '../../src/api/appointments';
import { useTranslation } from '../../src/i18n';

/**
 * Icon, label and accent per appointment type -- the legend reads from this too.
 *
 * Two colours for three types, on purpose: rose is the appointment where the
 * donor gives, clinical blue is the appointment where a clinician does
 * something to them. There is no third colour that does not already mean a
 * state, and the icons separate the two blues for anyone who needs them
 * separated.
 */
const TYPES: Record<string, { labelKey: string; icon: LucideIcon; tone: AccentName }> = {
  BLOOD_DONATION: { labelKey: 'medical.appointmentTypes.bloodDonation', icon: Droplet, tone: 'rose' },
  BLOOD_TEST: { labelKey: 'medical.appointmentTypes.bloodTest', icon: FlaskConical, tone: 'clinical' },
  CONSULTATION: { labelKey: 'medical.appointmentTypes.consultation', icon: Stethoscope, tone: 'clinical' },
};

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
 * Calendar, composed for V4: a scheduling interface.
 *
 * The month is the instrument, so it sits on a surface at the top with the
 * navigation at its right and the legend under it. The selected day's
 * appointments are rows -- time, organisation, type, status -- not cards,
 * because a day with three appointments is a list, and a list scans. Under
 * that, what is coming next across every month, so the tab answers "when is
 * my next one" without a hunt through the grid.
 */
export default function Calendar() {
  const { colors } = useDesign();
  const { t, formatMonth, formatWeekday, formatDate, formatTime } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  // Every appointment, not just the upcoming ones: looking back is half the
  // point of a calendar.
  const { data: appointments = [], isPending, isError, refetch, isRefetching } = useMyAppointments();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const upcoming = useMemo(
    () =>
      appointments
        .filter((apt) => new Date(apt.scheduledStart).getTime() >= today.getTime())
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
        .slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments],
  );

  const selectedDateAppointments = appointmentsByDate[selectedDate.toDateString()] ?? [];
  const isViewingCurrentMonth =
    viewDate.month === today.getMonth() && viewDate.year === today.getFullYear();
  const selectedIsToday = selectedDate.toDateString() === new Date().toDateString();

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

  const typeOf = (type?: string) => TYPES[type ?? ''] ?? null;
  const typeColor = (type?: string) => {
    const entry = typeOf(type);
    return entry ? colors[entry.tone].base : colors.textTertiary;
  };

  const appointmentRow = (apt: Appointment, withDate: boolean) => {
    const entry = typeOf(apt.appointmentType);
    const Icon = entry?.icon ?? CalendarDays;
    const typeLabel = entry ? t(entry.labelKey) : t('calendar.appointment');
    const when = withDate
      ? `${formatDate(apt.scheduledStart, 'medium')} · ${formatTime(apt.scheduledStart)}`
      : formatTime(apt.scheduledStart);
    return (
      <ListRow
        key={apt.id}
        icon={({ size, color }) => <Icon size={size} color={color} />}
        iconTone={entry?.tone}
        title={apt.organization.name}
        subtitle={`${when} · ${typeLabel}`}
        subtitleTrailing={
          <StatusDot label={t(`status.appointment.${apt.status}`)} tone={statusTone(apt.status)} />
        }
        accessibilityLabel={`${typeLabel}, ${when}, ${apt.organization.name}. ${t(
          `status.appointment.${apt.status}`,
        )}`}
        onPress={() => router.push(`/appointment/${apt.id}`)}
      />
    );
  };

  return (
    <ScrollScreen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Sections rhythm="major">
        <ScreenTitle
          title={t('calendar.title')}
          subtitle={t('calendar.subtitle')}
          action={
            <IconButton
              accessibilityLabel={t('calendar.a11ySchedule')}
              variant="tonal"
              tone="rose"
              onPress={() => router.push('/(booking)/select-type')}
              icon={({ size, color }) => <Plus size={size} color={color} />}
            />
          }
        />

        {/* ------------------------------------------------------ the month */}
        <Surface padded="lg">
          <MonthGrid
            year={viewDate.year}
            month={viewDate.month}
            today={today}
            selectedDay={
              viewDate.month === selectedDate.getMonth() && viewDate.year === selectedDate.getFullYear()
                ? selectedDate.getDate()
                : null
            }
            onSelectDay={(day) => setSelectedDate(new Date(viewDate.year, viewDate.month, day))}
            monthLabel={formatMonth(new Date(viewDate.year, viewDate.month, 1))}
            formatWeekday={(day) => formatWeekday(day, 'short')}
            onPrevious={goToPreviousMonth}
            onNext={goToNextMonth}
            previousLabel={t('calendar.a11yPreviousMonth')}
            nextLabel={t('calendar.a11yNextMonth')}
            dayAccessibilityLabel={(day) => {
              const items = dayAppointments(day);
              return `${formatDate(new Date(viewDate.year, viewDate.month, day), 'long')}${
                items.length ? `, ${t('calendar.appointmentsCount', { count: items.length })}` : ''
              }`;
            }}
            // One dot per appointment, up to three, each in its own type's colour.
            renderMarkers={(day) =>
              dayAppointments(day)
                .slice(0, 3)
                .map((apt) => (
                  <View
                    key={apt.id}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: typeColor(apt.appointmentType),
                    }}
                  />
                ))
            }
            // Only when you have wandered off it.
            action={
              isViewingCurrentMonth ? null : (
                <Button
                  label={t('common.today')}
                  size="sm"
                  variant="secondary"
                  block={false}
                  accessibilityLabel={t('calendar.a11yBackToToday')}
                  onPress={goToToday}
                />
              )
            }
          />

          <Row gap="lg" style={{ paddingTop: space.lg, paddingLeft: space.xs }}>
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
        </Surface>

        {/* --------------------------------------------- the day you picked */}
        <Section
          title={selectedIsToday ? t('common.today') : formatDate(selectedDate, 'full')}
          subtitle={selectedIsToday ? formatDate(selectedDate, 'full') : undefined}
        >
          {isPending ? (
            <Surface level="flat">
              <View style={{ gap: space.md }}>
                <Skeleton height={16} width="60%" />
                <Skeleton height={12} width="40%" />
              </View>
            </Surface>
          ) : isError ? (
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          ) : selectedDateAppointments.length === 0 ? (
            <EmptyState
              size="compact"
              title={t('calendar.nothingBooked')}
              description={t('calendar.noAppointmentsOnDay')}
              icon={({ size, color }) => <CalendarDays size={size} color={color} />}
              action={{
                label: t('calendar.scheduleOne'),
                onPress: () => router.push('/(booking)/select-type'),
              }}
            />
          ) : (
            <ListGroup rows={selectedDateAppointments.map((apt) => appointmentRow(apt, false))} />
          )}
        </Section>

        {/* ------------------------------------------------- what is next */}
        {!isPending && !isError && upcoming.length > 0 ? (
          <Section title={t('laboratory.upcomingAppointments')}>
            <ListGroup rows={upcoming.map((apt) => appointmentRow(apt, true))} />
          </Section>
        ) : null}
      </Sections>
    </ScrollScreen>
  );
}
