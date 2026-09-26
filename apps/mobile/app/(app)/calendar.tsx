import { useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, Droplet, FlaskConical, Plus, Stethoscope } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  MonthGrid,
  Row,
  ScreenTitle,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  iconSize,
  radius,
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
 * Two colours for three types, on purpose. A month cell can only show a dot, so
 * this is one of the few places colour genuinely carries the category and not
 * just decoration -- but there is no third colour available that does not
 * already mean something. Violet, which a consultation used to take, means the
 * AI produced something; amber and green mean a value is flagged or a check has
 * cleared, and this screen shows status badges in both.
 *
 * So the split is the one that is actually true: rose is the appointment where
 * the donor gives, clinical blue is the appointment where a clinician does
 * something to them. A blood test and a consultation being the same colour
 * groups two things that belong together, and the legend and the icons -- flask
 * against stethoscope -- separate them for anyone who needs them separated.
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

  const typeOf = (type?: string) => TYPES[type ?? ''] ?? null;
  const typeColor = (type?: string) => {
    const entry = typeOf(type);
    return entry ? colors[entry.tone].base : colors.textTertiary;
  };

  return (
    <ScrollScreen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Stack gap="xl">
        <ScreenTitle
          title={t('calendar.title')}
          subtitle={t('calendar.subtitle')}
          action={
            <Button
              label={t('calendar.schedule')}
              size="md"
              block={false}
              accessibilityLabel={t('calendar.a11ySchedule')}
              icon={({ size, color }) => <Plus size={size} color={color} />}
              onPress={() => router.push('/(booking)/select-type')}
            />
          }
        />

        {/* ------------------------------------------------------ the month */}
        <Surface>
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
            // One dot per appointment, up to three, each in its own type's
            // colour -- a single dot said "something today" and stopped there.
            renderMarkers={(day) =>
              dayAppointments(day)
                .slice(0, 3)
                .map((apt) => (
                  <View
                    key={apt.id}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: typeColor(apt.appointmentType),
                    }}
                  />
                ))
            }
            // Only when you have wandered off it -- a "today" button on the
            // month you are already looking at does nothing.
            action={
              isViewingCurrentMonth ? null : (
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
              )
            }
          />

          <Row gap="lg" style={{ justifyContent: 'center', paddingTop: space.lg }}>
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
                    // The status used to be a trailing Badge, which takes its
                    // full width before the title column gets any -- so the
                    // organisation name, the only thing that identifies the
                    // appointment, was the part that got cut, and cut sooner in
                    // Russian and Uzbek where both strings are longer. A
                    // StatusDot on the subtitle line says the same thing
                    // without competing for the same row; Status.tsx documents
                    // it as existing for exactly this.
                    subtitle={typeLabel}
                    subtitleTrailing={
                      <StatusDot
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
