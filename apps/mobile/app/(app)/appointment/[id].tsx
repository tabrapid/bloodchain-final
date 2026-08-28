import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Calendar,
  Clock,
  Building2,
  MapPin,
  Droplet,
  AlertCircle,
  XCircle,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Card,
  GlassCard,
  Screen,
} from '../../../src/components';
import { useAppointment, useCancelAppointment, useRescheduleAppointment } from '../../../src/hooks/useAppointments';
import { colors, spacing } from '../../../src/theme';

export default function AppointmentDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const { data: appointment, isLoading } = useAppointment(params.id);

  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cancelMutation = useCancelAppointment();
  const rescheduleMutation = useRescheduleAppointment();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return colors.success;
      case 'PENDING':
        return colors.warning;
      case 'CANCELLED':
        return colors.danger;
      case 'COMPLETED':
        return colors.primary;
      default:
        return colors.textMuted;
    }
  };

  const canCancel = () => {
    if (!appointment) return false;
    return ['PENDING', 'CONFIRMED'].includes(appointment.status);
  };

  const canReschedule = () => {
    if (!appointment) return false;
    return ['PENDING', 'CONFIRMED'].includes(appointment.status);
  };

  const handleCancel = () => {
    if (!showCancelReason) {
      setShowCancelReason(true);
      return;
    }

    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            try {
              await cancelMutation.mutateAsync({
                id: params.id,
                input: { reason: cancelReason.trim() || undefined },
              });
              router.back();
            } catch (err: any) {
              setError(err.message || 'Failed to cancel appointment');
            }
          },
        },
      ],
    );
  };

  const handleReschedule = () => {
    router.push({
      pathname: '/(booking)' as const,
      params: { reschedule: params.id },
    });
  };

  if (isLoading) {
    return (
      <Screen>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  if (!appointment) {
    return (
      <Screen>
        <AppText>Appointment not found</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(appointment.status) + '20' },
            ]}
          >
            <AppText
              style={[styles.statusText, { color: getStatusColor(appointment.status) }]}
            >
              {appointment.status}
            </AppText>
          </View>
          <AppText muted style={styles.refNumber}>
            {appointment.referenceNumber}
          </AppText>
        </View>

        <GlassCard style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Droplet size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Type
              </AppText>
              <AppText>{appointment.appointmentType.replace('_', ' ')}</AppText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Building2 size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Location
              </AppText>
              <AppText>{appointment.organization.name}</AppText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Calendar size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Date
              </AppText>
              <AppText>{formatDate(appointment.scheduledStart)}</AppText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Clock size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Time
              </AppText>
              <AppText>
                {formatTime(appointment.scheduledStart)} -{' '}
                {formatTime(appointment.scheduledEnd)}
              </AppText>
            </View>
          </View>

          {appointment.organization.address && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MapPin size={20} color={colors.primary} />
              </View>
              <View style={styles.detailInfo}>
                <AppText muted style={styles.detailLabel}>
                  Address
                </AppText>
                <AppText>{appointment.organization.address}</AppText>
              </View>
            </View>
          )}
        </GlassCard>

        {appointment.notes && (
          <Card style={styles.notesCard}>
            <AppText muted style={styles.notesLabel}>
              Notes
            </AppText>
            <AppText>{appointment.notes}</AppText>
          </Card>
        )}

        {appointment.cancellationReason && (
          <Card style={styles.cancellationCard}>
            <View style={styles.cancellationHeader}>
              <XCircle size={20} color={colors.danger} />
              <AppText style={styles.cancellationTitle}>Cancelled</AppText>
            </View>
            <AppText muted style={styles.cancellationReason}>
              {appointment.cancellationReason}
            </AppText>
          </Card>
        )}

        {error && (
          <Card style={styles.errorCard}>
            <AlertCircle size={20} color={colors.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </Card>
        )}

        {showCancelReason && (
          <Card style={styles.cancelReasonCard}>
            <AppText variant="heading" style={styles.cancelTitle}>
              Cancellation Reason
            </AppText>
            <View style={styles.cancelInput}>
              <AppText muted style={{ fontSize: 14 }}>
                Please provide a reason for cancellation (optional)...
              </AppText>
            </View>
          </Card>
        )}
      </ScrollView>

      {(canCancel() || canReschedule()) && (
        <View style={styles.footer}>
          {canReschedule() && (
            <AppButton onPress={handleReschedule} variant="secondary">
              Reschedule
            </AppButton>
          )}
          {canCancel() && (
            <AppButton
              onPress={handleCancel}
              variant={canReschedule() ? 'secondary' : 'primary'}
              loading={cancelMutation.isPending}
              style={canReschedule() ? styles.cancelButton : undefined}
            >
              {showCancelReason ? 'Confirm Cancellation' : 'Cancel Appointment'}
            </AppButton>
          )}
        </View>
      )}

      {!canCancel() && !canReschedule() && (
        <View style={styles.footer}>
          <AppButton variant="secondary" onPress={() => router.back()}>
            Go Back
          </AppButton>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  refNumber: {
    fontSize: 13,
    letterSpacing: 1,
  },
  detailsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  notesCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  notesLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  cancellationCard: {
    padding: spacing.lg,
    backgroundColor: colors.danger + '10',
    marginBottom: spacing.lg,
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cancellationTitle: {
    color: colors.danger,
    fontWeight: '600',
  },
  cancellationReason: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.danger + '15',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
  },
  cancelReasonCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cancelTitle: {
    marginBottom: spacing.md,
  },
  cancelInput: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
  },
  footer: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});