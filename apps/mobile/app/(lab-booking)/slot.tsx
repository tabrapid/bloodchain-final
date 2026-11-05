import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
  iconSize,
  useDesign,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useLaboratorySlots } from '../../src/hooks/useLaboratory';
import type { AppointmentSlot } from '../../src/api/laboratory';
import { useTranslation } from '../../src/i18n';
import { LAB_BOOKING_STEP_COUNT } from './test-type';

/**
 * Step 4: which time.
 *
 * `GET /laboratories/:id/slots` already answers per slot whether it is still
 * bookable (`isAvailable`), taking both the slot's own capacity and the
 * appointments already sitting on it into account, so nothing is recomputed
 * here -- a slot the server calls unavailable is simply not offered.
 */
export default function SelectLabSlot() {
  const { t, formatDayHeading, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{
    testTypeId: string;
    laboratoryId: string;
    date: string;
  }>();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const { data: slots = [], isPending, isError, refetch } = useLaboratorySlots(
    params.laboratoryId,
    params.testTypeId,
    params.date,
  );

  const bookable = useMemo(() => slots.filter((slot) => slot.isAvailable !== false), [slots]);

  const groups = useMemo(() => {
    const morning: AppointmentSlot[] = [];
    const afternoon: AppointmentSlot[] = [];
    const evening: AppointmentSlot[] = [];
    bookable.forEach((slot) => {
      const hour = new Date(slot.startAt).getHours();
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    });
    return [
      { labelKey: 'booking.morning', icon: Sunrise, slots: morning },
      { labelKey: 'booking.afternoon', icon: Sun, slots: afternoon },
      { labelKey: 'booking.evening', icon: Sunset, slots: evening },
    ] satisfies { labelKey: string; icon: LucideIcon; slots: AppointmentSlot[] }[];
  }, [bookable]);

  const subtitle = useMemo(() => {
    if (!params.date) return t('booking.chooseTime');
    const [y, m, d] = params.date.split('-').map(Number);
    if (!y || !m || !d) return t('booking.chooseTime');
    return formatDayHeading(new Date(y, m - 1, d));
  }, [params.date, t, formatDayHeading]);

  return (
    <FlowStep
      step={4}
      total={LAB_BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 4, total: LAB_BOOKING_STEP_COUNT })}
      title={t('booking.selectTime')}
      subtitle={subtitle}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/laboratory')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selectedSlotId}
      onPrimary={() =>
        router.push({
          pathname: '/(lab-booking)/review',
          params: {
            testTypeId: params.testTypeId,
            laboratoryId: params.laboratoryId,
            date: params.date,
            slotId: selectedSlotId!,
          },
        })
      }
    >
      {isPending ? (
        <Stack gap="lg">
          <Skeleton height={14} width="30%" />
          <Skeleton height={52} />
        </Stack>
      ) : isError ? (
        <ErrorState
          title={t('booking.timesFailed')}
          description={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : bookable.length === 0 ? (
        <EmptyState
          title={t('labBooking.noSlots')}
          description={t('labBooking.noSlotsHint')}
          action={{ label: t('labBooking.pickAnotherDay'), onPress: () => router.back() }}
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
                  <OptionGrid
                    accessibilityLabel={t(group.labelKey)}
                    columns={3}
                    value={selectedSlotId}
                    onChange={setSelectedSlotId}
                    options={group.slots.map((slot) => ({
                      value: slot.id,
                      label: formatTime(slot.startAt),
                    }))}
                  />
                </Stack>
              );
            })}
        </Stack>
      )}
    </FlowStep>
  );
}
