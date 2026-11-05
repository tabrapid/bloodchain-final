import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useLaboratoryAvailableDates } from '../../src/hooks/useLaboratory';
import { useTranslation } from '../../src/i18n';
import { LAB_BOOKING_STEP_COUNT } from './test-type';

function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Step 3: which day.
 *
 * This used to be a flat list of the next twenty-one days with no availability
 * on it at all, because `GET /laboratories/:id/slots` answers one day at a
 * time and drawing a real month would have meant twenty-one requests. The API
 * now answers a whole range in one call, so the donor sees the same month grid
 * the donation wizard uses -- open days marked, closed days visibly disabled
 * rather than tappable-then-empty.
 */
export default function SelectLabDate() {
  const { t, formatWeekday, formatMonth, formatDate } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ testTypeId: string; laboratoryId: string }>();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // One request for the whole visible month. The window starts at today when
  // the donor is looking at the current month, so the server is never asked to
  // summarise days nobody can book.
  const monthStart = new Date(year, month, 1);
  const rangeStart = monthStart < today ? today : monthStart;
  const rangeEnd = new Date(year, month + 1, 0);

  const { data: availability, isLoading, isError, refetch } = useLaboratoryAvailableDates(
    params.laboratoryId,
    params.testTypeId,
    toDateParam(rangeStart),
    toDateParam(rangeEnd),
  );

  const openDates = useMemo(() => {
    const open = new Set<string>();
    for (const day of availability?.dates ?? []) {
      if (day.isAvailable) open.add(day.date);
    }
    return open;
  }, [availability]);

  const changeMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
    setSelected(null);
  };

  const isOpen = (day: number) => openDates.has(toDateParam(new Date(year, month, day)));

  // Stepping back is only useful while the previous month can still hold a
  // bookable day.
  const canGoBack = monthStart > today;
  const hasLoaded = Boolean(availability) && !isLoading;
  const monthIsEmpty = hasLoaded && openDates.size === 0;

  const selectedDay = selected ? Number(selected.split('-')[2]) : null;

  return (
    <FlowStep
      step={3}
      total={LAB_BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 3, total: LAB_BOOKING_STEP_COUNT })}
      title={t('labBooking.selectDateTitle')}
      subtitle={t('labBooking.selectDateSubtitleCalendar')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/laboratory')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selected}
      onPrimary={() =>
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
      <Stack gap="lg">
        {isError ? (
          <SectionError
            message={t('labBooking.datesFailed')}
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
            onSelectDay={(day) => setSelected(toDateParam(new Date(year, month, day)))}
            isDisabled={(day) => !isOpen(day)}
            monthLabel={formatMonth(new Date(year, month, 1), 'long')}
            formatWeekday={(day) => formatWeekday(day, 'narrow')}
            onPrevious={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            previousLabel={t('booking.previousMonth')}
            nextLabel={t('booking.nextMonth')}
            previousDisabled={!canGoBack}
            dayAccessibilityLabel={(day) =>
              `${formatDate(new Date(year, month, day), 'long')}${
                isOpen(day) ? '' : `, ${t('booking.unavailableDay')}`
              }`
            }
            renderMarkers={(day) =>
              isOpen(day) ? (
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
            description={t('labBooking.noOpenDatesHint')}
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
