import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Calendar, Clock, Building2, Droplet, AlertCircle } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen } from '../../src/components';
import {
  useAvailability,
  useBookAppointment,
  useOrganizations,
  useRescheduleAppointment,
} from '../../src/hooks/useAppointments';
import { spacing, useTheme, ThemeColors } from '../../src/theme';

export default function ReviewBooking() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    slotId: string;
    organizationId: string;
    type: string;
    date: string;
    rescheduleAppointmentId?: string;
  }>();
  const isRescheduling = Boolean(params.rescheduleAppointmentId);

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: slots,
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailability({ date: params.date });
  const slot = slots?.find((s) => s.id === params.slotId);

  const {
    data: organizations,
    isLoading: orgsLoading,
    isError: orgsError,
    refetch: refetchOrgs,
  } = useOrganizations();
  const organization = organizations?.find((o) => o.id === params.organizationId);

  const isLoading = slotsLoading || orgsLoading;
  const hasLoadError = slotsError || orgsError;
  const notFound = !isLoading && !hasLoadError && (!slot || !organization);

  const bookMutation = useBookAppointment();
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'BLOOD_DONATION':
        return 'Blood Donation';
      case 'BLOOD_TEST':
        return 'Blood Test';
      case 'CONSULTATION':
        return 'Consultation';
      default:
        return type;
    }
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      const result = params.rescheduleAppointmentId
        ? await rescheduleMutation.mutateAsync({
            id: params.rescheduleAppointmentId,
            input: { newSlotId: params.slotId },
          })
        : await bookMutation.mutateAsync({
            slotId: params.slotId,
            appointmentType: params.type,
            notes: notes.trim() || undefined,
          });
      router.replace({
        pathname: '/(booking)/confirmation',
        params: {
          appointmentId: result.id,
          ...(isRescheduling && { rescheduled: '1' }),
        },
      });
    } catch (err: any) {
      setError(
        err.message ||
          (isRescheduling
            ? 'Failed to reschedule appointment. Please try again.'
            : 'Failed to book appointment. Please try again.'),
      );
    }
  };

  const isSaving = isRescheduling ? rescheduleMutation.isPending : bookMutation.isPending;

  if (isLoading) {
    return (
      <Screen>
        <AppText muted>Loading...</AppText>
      </Screen>
    );
  }

  if (hasLoadError || notFound) {
    return (
      <Screen>
        <Card style={styles.errorCard}>
          <AlertCircle size={20} color={colors.danger} />
          <AppText style={styles.errorText}>
            {hasLoadError
              ? "Couldn't load your booking details. Check your connection and try again."
              : 'This time slot is no longer available. Please choose another time.'}
          </AppText>
        </Card>
        <View style={styles.footer}>
          {hasLoadError && (
            <AppButton
              onPress={() => {
                refetchSlots();
                refetchOrgs();
              }}
            >
              Retry
            </AppButton>
          )}
          <AppButton
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            Back
          </AppButton>
        </View>
      </Screen>
    );
  }

  if (!slot || !organization) {
    return null;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          {isRescheduling ? 'Review Reschedule' : 'Review Booking'}
        </AppText>
        <AppText muted style={styles.subtitle}>
          {isRescheduling
            ? 'Please review your new appointment time before confirming.'
            : 'Please review your appointment details before confirming.'}
        </AppText>

        <GlassCard style={styles.summaryCard}>
          <AppText variant="heading" style={styles.sectionTitle}>
            Appointment Details
          </AppText>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Droplet size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Type
              </AppText>
              <AppText>{getTypeLabel(params.type)}</AppText>
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
              <AppText>{organization.name}</AppText>
              {organization.address && (
                <AppText muted style={styles.addressText}>
                  {organization.address}
                </AppText>
              )}
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
              <AppText>{formatDate(params.date)}</AppText>
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
                {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
              </AppText>
            </View>
          </View>
        </GlassCard>

        <Card style={styles.notesCard}>
          <AppText variant="heading" style={styles.sectionTitle}>
            Notes (Optional)
          </AppText>
          <View style={styles.notesInput}>
            <AppText muted style={{ fontSize: 14 }}>
              Add any notes or special requirements for your appointment...
            </AppText>
          </View>
        </Card>

        {error && (
          <Card style={styles.errorCard}>
            <AlertCircle size={20} color={colors.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </Card>
        )}

        <Card style={styles.infoCard}>
          <AppText muted style={styles.infoText}>
            By confirming this booking, you agree to arrive on time for your appointment.
            Cancellations must be made at least 24 hours in advance.
          </AppText>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          onPress={handleConfirm}
          loading={isSaving}
          disabled={isSaving}
        >
          {isRescheduling ? 'Confirm Reschedule' : 'Confirm Booking'}
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={isSaving}
        >
          Back
        </AppButton>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.xl,
    },
    title: {
      marginBottom: spacing.xs,
    },
    subtitle: {
      marginBottom: spacing.xl,
    },
    summaryCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionTitle: {
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
      backgroundColor: colors.primaryMuted,
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
    addressText: {
      fontSize: 13,
      marginTop: 2,
    },
    notesCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    notesInput: {
      padding: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
    },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.dangerMuted,
      marginBottom: spacing.lg,
    },
    errorText: {
      color: colors.onMuted.danger,
      flex: 1,
    },
    infoCard: {
      padding: spacing.md,
      backgroundColor: colors.surfaceElevated,
    },
    infoText: {
      fontSize: 13,
      lineHeight: 18,
    },
    footer: {
      paddingTop: spacing.lg,
    },
    backButton: {
      marginTop: spacing.md,
    },
  });
}