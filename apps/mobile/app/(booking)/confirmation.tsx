import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { AppButton, AppText, Badge, GlassCard, Screen } from '../../src/components';
import { useAppointment } from '../../src/hooks/useAppointments';
import { layout, spacing, useTheme, ThemeColors } from '../../src/theme';

export default function BookingConfirmation() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ appointmentId: string; rescheduled?: string }>();
  const { data: appointment, isLoading } = useAppointment(params.appointmentId);
  const isRescheduled = params.rescheduled === '1';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <LinearGradient
            colors={['#63C29B', '#3EA87E']}
            style={styles.successBadge}
          >
            <Check size={38} color="#FFFFFF" strokeWidth={3} />
          </LinearGradient>
        </View>

        <AppText style={styles.title}>
          {isRescheduled ? 'Appointment rescheduled!' : 'Appointment confirmed!'}
        </AppText>
        <AppText muted style={styles.subtitle}>
          {isRescheduled
            ? 'Your appointment has been moved to the new date and time.'
            : 'Your appointment has been successfully scheduled.'}
        </AppText>

        {isLoading ? (
          <AppText muted>Loading...</AppText>
        ) : appointment ? (
          <GlassCard tier="elevated" style={styles.detailsCard}>
            <View style={styles.refRow}>
              <AppText muted>Reference Number</AppText>
              <AppText variant="heading" style={styles.refNumber}>
                {appointment.referenceNumber}
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                Type
              </AppText>
              <AppText>{appointment.appointmentType.replace('_', ' ')}</AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                Organization
              </AppText>
              <AppText>{appointment.organization.name}</AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                Date
              </AppText>
              <AppText>{formatDate(appointment.scheduledStart)}</AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                Time
              </AppText>
              <AppText>
                {formatTime(appointment.scheduledStart)} -{' '}
                {formatTime(appointment.scheduledEnd)}
              </AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                Status
              </AppText>
              <Badge variant={appointment.status === 'CONFIRMED' ? 'success' : 'warning'}>
                {appointment.status.replace(/_/g, ' ')}
              </Badge>
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.reminderCard}>
          <AppText muted style={styles.reminderText}>
            Please arrive 15 minutes before your scheduled appointment time.
            Remember to bring a valid ID.
          </AppText>
        </GlassCard>
      </View>

      <View style={styles.footer}>
        <AppButton onPress={() => router.replace('/(app)/calendar')}>
          View calendar
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.replace('/home' as const)}
          style={styles.homeButton}
        >
          Back to app
        </AppButton>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      flex: 1,
    },
    successIcon: {
      alignItems: 'center',
      marginBottom: spacing.xl,
      marginTop: spacing.xl,
    },
    successBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#63C29B',
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    title: {
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -0.81,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    detailsCard: {
      padding: spacing.lg,
      marginBottom: layout.cardGap,
    },
    refRow: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    refNumber: {
      fontSize: 20,
      letterSpacing: 1,
      marginTop: spacing.xs,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.lg,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    detailLabel: {
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reminderCard: {
      padding: spacing.md,
    },
    reminderText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    footer: {
      paddingTop: spacing.lg,
    },
    homeButton: {
      marginTop: spacing.md,
    },
  });
}