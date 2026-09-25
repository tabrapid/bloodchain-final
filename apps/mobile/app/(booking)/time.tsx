import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import { Sun, Sunrise, Sunset } from 'lucide-react-native';
import {
  EmptyState,
  ErrorState,
  FlowStep,
  OptionGrid,
  Row,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
  iconSize,
  useDesign,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useAvailability } from '../../src/hooks/useAppointments';
import type { AppointmentSlot } from '../../src/api/appointments';
import { useTranslation } from '../../src/i18n';
import { BOOKING_STEP_COUNT } from './select-type';

/** Below this, the number of remaining spots is worth showing beside the time. */
const SCARCE_SPOTS = 3;

export default function SelectTime() {
  const { t, formatDayHeading, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{
    organizationId: string;
    type: string;
    date: string;
    rescheduleAppointmentId?: string;
  }>();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const {
    data: slots = [],
    isLoading,
    isError,
    refetch,
  } = useAvailability({
    organizationId: params.organizationId,
    appointmentType: params.type,
    date: params.date,
  });

  const groups = useMemo(() => {
    const morning: AppointmentSlot[] = [];
    const afternoon: AppointmentSlot[] = [];
    const evening: AppointmentSlot[] = [];
    slots.forEach((slot) => {
      const hour = new Date(slot.startAt).getHours();
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    });
    return [
      // Keys, not words: this memo is rebuilt when the slots change, not when
      // the language does, so a translated string here would go stale.
      { labelKey: 'booking.morning', icon: Sunrise, slots: morning },
      { labelKey: 'booking.afternoon', icon: Sun, slots: afternoon },
      { labelKey: 'booking.evening', icon: Sunset, slots: evening },
    ] satisfies { labelKey: string; icon: LucideIcon; slots: AppointmentSlot[] }[];
  }, [slots]);

  const subtitle = useMemo(() => {
    if (!params.date) return t('booking.chooseTime');
    const [y, m, d] = params.date.split('-').map(Number);
    if (!y || !m || !d) return t('booking.chooseTime');
    // The shared formatter, not a hardcoded en-US: this line was the one place
    // in the booking flow that would still have read "Mon, Mar 3" to a donor
    // reading the rest of the screen in Uzbek.
    return formatDayHeading(new Date(y, m - 1, d));
  }, [params.date, t, formatDayHeading]);

  return (
    <FlowStep
      step={4}
      total={BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 4, total: BOOKING_STEP_COUNT })}
      title={params.rescheduleAppointmentId ? t('booking.pickNewTime') : t('booking.selectTime')}
      subtitle={subtitle}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/donate')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selectedSlotId}
      onPrimary={() =>
        router.push({
          pathname: '/(booking)/review',
          params: {
            slotId: selectedSlotId!,
            organizationId: params.organizationId,
            type: params.type,
            date: params.date,
            ...(params.rescheduleAppointmentId && {
              rescheduleAppointmentId: params.rescheduleAppointmentId,
            }),
          },
        })
      }
    >
      {isLoading ? (
        <Stack gap="lg">
          <Skeleton height={14} width="30%" />
          <Skeleton height={52} />
          <Skeleton height={52} />
        </Stack>
      ) : isError ? (
        <ErrorState
          title={t('booking.timesFailed')}
          description={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : slots.length === 0 ? (
        <EmptyState
          title={t('booking.noTimes')}
          description={t('booking.noTimesHint')}
          action={{ label: t('common.back'), onPress: () => router.back() }}
        />
      ) : (
        <Stack gap="xl">
          {groups
            .filter((group) => group.slots.length > 0)
            .map((group) => {
              const Icon = group.icon;
              return (
                <Stack gap="md" key={group.labelKey}>
                  <Row gap="sm">
                    <Icon size={iconSize.sm} color={colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <SectionHeader title={t(group.labelKey)} />
                    </View>
                  </Row>
                  {/* Three to a row rather than four: a time is four
                      characters wide and a scarcity note sits under it. */}
                  <OptionGrid
                    accessibilityLabel={t(group.labelKey)}
                    columns={3}
                    value={selectedSlotId}
                    onChange={setSelectedSlotId}
                    options={group.slots.map((slot) => ({
                      value: slot.id,
                      label: formatTime(slot.startAt),
                      accessibilityLabel:
                        slot.availableSpots <= SCARCE_SPOTS
                          ? `${formatTime(slot.startAt)}, ${t('booking.spotsLeft', {
                              count: slot.availableSpots,
                            })}`
                          : formatTime(slot.startAt),
                    }))}
                  />
                  {/* The scarce ones, said once under the grid rather than
                      crammed into a cell that is four characters wide. */}
                  {group.slots.some((slot) => slot.availableSpots <= SCARCE_SPOTS) ? (
                    <Text variant="caption" tone="warning">
                      {group.slots
                        .filter((slot) => slot.availableSpots <= SCARCE_SPOTS)
                        .map(
                          (slot) =>
                            `${formatTime(slot.startAt)} — ${t('booking.spotsLeft', {
                              count: slot.availableSpots,
                            })}`,
                        )
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Stack>
              );
            })}
        </Stack>
      )}
    </FlowStep>
  );
}
