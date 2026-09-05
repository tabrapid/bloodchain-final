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

/** Below this, the number of remaining spots is worth showing on the chip. */
const SCARCE_SPOTS = 3;

export default function SelectTime() {
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
      { label: 'Morning', icon: Sunrise, slots: morning },
      { label: 'Afternoon', icon: Sun, slots: afternoon },
      { label: 'Evening', icon: Sunset, slots: evening },
    ] satisfies { label: string; icon: LucideIcon; slots: AppointmentSlot[] }[];
  }, [slots]);

  const subtitle = useMemo(() => {
    if (!params.date) return 'Choose an available time';
    const [y, m, d] = params.date.split('-').map(Number);
    if (!y || !m || !d) return 'Choose an available time';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [params.date]);

  return (
    <BookingStep
      step={4}
      title={params.rescheduleAppointmentId ? 'Pick a new time' : 'Select time'}
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
        <AppText style={styles.status}>Loading available times…</AppText>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title="Couldn't load times"
            description="Something went wrong reaching the server. Check your connection and try again."
          />
          <AppButton
            variant="secondary"
            onPress={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            style={styles.retry}
          >
            Retry
          </AppButton>
        </GlassCard>
      ) : slots.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title="No available times"
            description="There are no open slots on this date. Go back and pick another one."
          />
        </GlassCard>
      ) : (
        groups
          .filter((group) => group.slots.length > 0)
          .map((group) => {
            const Icon = group.icon;
            return (
              <View key={group.label}>
                <View style={styles.groupHeader}>
                  <Icon size={16} color={colors.textMuted} />
                  <SectionHeader>{group.label}</SectionHeader>
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
