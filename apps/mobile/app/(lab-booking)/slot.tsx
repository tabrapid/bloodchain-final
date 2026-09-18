import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  BookingStep,
  EmptyState,
  GlassCard,
  SectionHeader,
} from '../../src/components';
import { useLaboratorySlots } from '../../src/hooks/useLaboratory';
import type { AppointmentSlot } from '../../src/api/laboratory';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    testTypeId: string;
    laboratoryId: string;
    date: string;
  }>();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const {
    data: slots = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useLaboratorySlots(params.laboratoryId, params.testTypeId, params.date);

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
    <BookingStep
      step={4}
      title={t('booking.selectTime')}
      subtitle={subtitle}
      nextDisabled={!selectedSlotId}
      onClose={() => router.replace('/(app)/laboratory')}
      onNext={() =>
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
      {isLoading ? (
        <AppText style={styles.status}>{t('booking.loadingTimes')}</AppText>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState title={t('booking.timesFailed')} description={t('common.offline')} />
          <AppButton
            variant="secondary"
            onPress={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            style={styles.retry}
          >
            {t('common.retry')}
          </AppButton>
        </GlassCard>
      ) : bookable.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('labBooking.noSlots')}
            description={t('labBooking.noSlotsHint')}
          />
          <AppButton variant="secondary" onPress={() => router.back()} style={styles.retry}>
            {t('labBooking.pickAnotherDay')}
          </AppButton>
        </GlassCard>
      ) : (
        groups
          .filter((group) => group.slots.length > 0)
          .map((group) => {
            const Icon = group.icon;
            return (
              <View key={group.labelKey}>
                <View style={styles.groupHeader}>
                  <Icon size={16} color={colors.textMuted} />
                  <SectionHeader>{t(group.labelKey)}</SectionHeader>
                </View>
                <View style={styles.grid}>
                  {group.slots.map((slot) => {
                    const selected = selectedSlotId === slot.id;
                    const remaining = slot.capacity - slot.bookedCount;
                    return (
                      <View key={slot.id} style={styles.cell}>
                        <Pressable
                          onPress={() => setSelectedSlotId(slot.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [
                            styles.chip,
                            selected && styles.chipSelected,
                            { opacity: pressed && !selected ? 0.7 : 1 },
                          ]}
                        >
                          <AppText style={[styles.chipTime, selected && styles.chipTimeSelected]}>
                            {formatTime(slot.startAt)}
                          </AppText>
                          {remaining <= 3 && (
                            <AppText
                              style={[styles.chipMeta, selected && styles.chipMetaSelected]}
                            >
                              {t('labBooking.spotsLeft', { count: remaining })}
                            </AppText>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
      )}
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    status: {
      fontSize: 13,
      color: colors.textMuted,
    },
    stateCard: {
      paddingVertical: spacing.lg,
    },
    retry: {
      marginTop: spacing.md,
      alignSelf: 'center',
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -5,
    },
    cell: {
      width: `${100 / 3}%`,
      paddingHorizontal: 5,
      paddingBottom: 10,
    },
    chip: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: colors.glass.standard.fill,
      borderWidth: 1,
      borderColor: colors.glass.standard.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: 'transparent',
    },
    chipTime: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    chipTimeSelected: {
      fontWeight: '700',
      color: colors.white,
    },
    chipMeta: {
      fontSize: 10,
      color: colors.onMuted.warning,
      marginTop: 1,
    },
    chipMetaSelected: {
      color: 'rgba(255,255,255,0.85)',
    },
  });
}
