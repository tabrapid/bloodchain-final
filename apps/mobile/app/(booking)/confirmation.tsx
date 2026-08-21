import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen } from '../../src/components';
import { useAppointment } from '../../src/hooks/useAppointments';
import { colors, spacing } from '../../src/theme';

export default function BookingConfirmation() {
  const params = useLocalSearchParams<{ appointmentId: string }>();
  const { data, isLoading } = useAppointment(params.appointmentId);
  const appointment = data?.data;

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
          <CheckCircle size={64} color={colors.success} />
        </View>

        <AppText variant="title" style={styles.title}>
          Booking Confirmed!
        </AppText>
        <AppText muted style={styles.subtitle}>
          Your appointment has been successfully scheduled.
        </AppText>

        {isLoading ? (
          <AppText muted>Loading...</AppText>
        ) : appointment ? (
          <GlassCard style={styles.detailsCard}>
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
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      appointment.status === 'CONFIRMED'
                        ? colors.success + '20'
                        : colors.warning + '20',
                  },
                ]}
              >
                <AppText
                  style={{
                    color: appointment.status === 'CONFIRMED' ? colors.success : colors.warning,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {appointment.status}
                </AppText>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <Card style={styles.reminderCard}>
          <AppText muted style={styles.reminderText}>
            Please arrive 15 minutes before your scheduled appointment time.
            Remember to bring a valid ID.
          </AppText>
        </Card>
      </View>

      <View style={styles.footer}>
        <AppButton onPress={() => router.replace('/(app)/calendar')}>
          View Calendar
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.replace('/(app)/')}
          style={styles.homeButton}
        >
          Go to Home
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  detailsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  reminderCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
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