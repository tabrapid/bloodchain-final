import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Sun, Sunrise } from 'lucide-react-native';
import { AppButton, AppText, Card, EmptyState, GlassCard, Screen } from '../../src/components';
import { useAvailability } from '../../src/hooks/useAppointments';
import { colors, spacing, radius } from '../../src/theme';

export default function SelectTime() {
  const params = useLocalSearchParams<{
    organizationId: string;
    type: string;
    date: string;
  }>();

  const { data: slots = [], isLoading } = useAvailability({
    organizationId: params.organizationId,
    appointmentType: params.type,
    date: params.date,
  });

  const groupedSlots = useMemo(() => {
    const morning: typeof slots = [];
    const afternoon: typeof slots = [];
    const evening: typeof slots = [];

    slots.forEach((slot) => {
      const hour = new Date(slot.startAt).getHours();
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  }, [slots]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleSelect = (slotId: string) => {
    router.push({
      pathname: '/(booking)/review',
      params: {
        slotId,
        organizationId: params.organizationId,
        type: params.type,
        date: params.date,
      },
    });
  };

  const renderSlotGroup = (title: string, slotsList: typeof slots, Icon: typeof Sun) => {
    if (slotsList.length === 0) return null;

    return (
      <View style={styles.slotGroup}>
        <View style={styles.groupHeader}>
          <Icon size={18} color={colors.textMuted} />
          <AppText muted style={styles.groupTitle}>
            {title}
          </AppText>
        </View>
        <View style={styles.slotsGrid}>
          {slotsList.map((slot) => (
            <TouchableOpacity
              key={slot.id}
              onPress={() => handleSelect(slot.id)}
              activeOpacity={0.8}
            >
              <GlassCard style={styles.slotCard}>
                <AppText variant="heading">{formatTime(slot.startAt)}</AppText>
                <AppText muted style={styles.slotDuration}>
                  {Math.round(
                    (new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime()) /
                      60000,
                  )}{' '}
                  min
                </AppText>
                <AppText muted style={styles.slotAvailability}>
                  {slot.availableSpots} spot{slot.availableSpots !== 1 ? 's' : ''} left
                </AppText>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          Select Time
        </AppText>
        <AppText muted style={styles.subtitle}>
          Choose an available time for your appointment.
        </AppText>

        {isLoading ? (
          <AppText muted>Loading available times...</AppText>
        ) : slots.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title="No available times"
              description="There are no available appointment slots for this date. Please select another date."
            />
          </Card>
        ) : (
          <>
            {renderSlotGroup('Morning', groupedSlots.morning, Sunrise)}
            {renderSlotGroup('Afternoon', groupedSlots.afternoon, Sun)}
            {renderSlotGroup('Evening', groupedSlots.evening, Sun)}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton variant="secondary" onPress={() => router.back()}>
          Back
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  emptyCard: {
    paddingVertical: spacing.xl,
  },
  slotGroup: {
    marginBottom: spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  groupTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotCard: {
    width: '30%',
    padding: spacing.md,
    alignItems: 'center',
  },
  slotDuration: {
    fontSize: 12,
    marginTop: 2,
  },
  slotAvailability: {
    fontSize: 11,
    marginTop: 2,
    color: colors.success,
  },
  footer: {
    paddingTop: spacing.lg,
  },
});