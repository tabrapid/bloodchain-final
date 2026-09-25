import { useState, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import {
  EmptyState,
  FlowStep,
  LoadingSection,
  MonthGrid,
  Row,
  SectionError,
  Stack,
  Surface,
  Text,
  radius,
  space,
  useDesign,
} from '../../src/design';
import { useAvailability } from '../../src/hooks/useAppointments';
import { useTranslation } from '../../src/i18n';
import { BOOKING_STEP_COUNT } from './select-type';

function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export default function SelectDate() {
  const { t, formatMonth, formatWeekday, formatDate } = useTranslation();
  const { colors } = useDesign();
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

  const daysInThisMonth = new Date(year, month + 1, 0).getDate();

  // "Nothing open this month" and "still loading" look identical on a grid of
  // grey cells, so the one that is true is said out loud.
  const monthIsEmpty =
    !isLoading &&
    !isError &&
    !Array.from({ length: daysInThisMonth }, (_, index) => index + 1).some(isBookable);

  return (
    <FlowStep
      step={3}
      total={BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 3, total: BOOKING_STEP_COUNT })}
      title={params.rescheduleAppointmentId ? t('booking.pickNewDate') : t('booking.selectDate')}
      subtitle={t('booking.openSlotsOnly')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/donate')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={selectedDay === null}
      onPrimary={() =>
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
      <Stack gap="lg">
        {isError ? (
          <SectionError
            message={t('booking.availabilityFailed')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        ) : null}

        <Surface>
          <MonthGrid
            year={year}
            month={month}
            today={today}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            isDisabled={(day) => !isBookable(day)}
            monthLabel={formatMonth(new Date(year, month, 1), 'long')}
            formatWeekday={(day) => formatWeekday(day, 'narrow')}
            onPrevious={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            previousLabel={t('booking.previousMonth')}
            nextLabel={t('booking.nextMonth')}
            previousDisabled={!canGoBack}
            dayAccessibilityLabel={(day) =>
              `${formatDate(new Date(year, month, day), 'long')}${
                isBookable(day) ? '' : `, ${t('booking.unavailableDay')}`
              }`
            }
            renderMarkers={(day) =>
              isBookable(day) ? (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.success.base,
                  }}
                />
              ) : null
            }
          />
        </Surface>

        {isLoading ? (
          <LoadingSection label={t('booking.loadingAvailability')} />
        ) : monthIsEmpty ? (
          <EmptyState
            title={t('booking.noOpenDates')}
            description={t('booking.noOpenDatesHint')}
            action={{ label: t('booking.nextMonth'), onPress: () => changeMonth(1) }}
          />
        ) : (
          <Row gap="sm">
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.full,
                backgroundColor: colors.success.base,
                marginLeft: space.xs,
              }}
            />
            <Text variant="caption" tone="tertiary">
              {t('booking.datesWithSlots')}
            </Text>
          </Row>
        )}
      </Stack>
    </FlowStep>
  );
}
