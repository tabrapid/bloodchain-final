import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  BookingStep,
  EmptyState,
  GlassCard,
  SectionHeader,
} from '../../src/components';
import { useAvailability } from '../../src/hooks/useAppointments';
import type { AppointmentSlot } from '../../src/api/appointments';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/** Below this, the number of remaining spots is worth showing on the chip. */
const SCARCE_SPOTS = 3;

export default function SelectTime() {
  const { t, formatDayHeading } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    isRefetching,
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
    <BookingStep
      step={4}
      title={params.rescheduleAppointmentId ? t('booking.pickNewTime') : t('booking.selectTime')}
      subtitle={subtitle}
      nextDisabled={!selectedSlotId}
      onNext={() =>
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
        <AppText style={styles.status}>{t('booking.loadingTimes')}</AppText>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('booking.timesFailed')}
            description={t('common.offline')}
          />
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
      ) : slots.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('booking.noTimes')}
            description={t('booking.noTimesHint')}
          />
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
                    const scarce = slot.availableSpots <= SCARCE_SPOTS;
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
                          {scarce && (
                            <AppText
                              style={[styles.chipMeta, selected && styles.chipMetaSelected]}
                            >
                              {slot.availableSpots} left
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
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
