import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Calendar, Building2, Droplet, AlertCircle } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  AppTextInput,
  BookingStep,
  GlassCard,
  Screen,
} from '../../src/components';
import {
  useAvailability,
  useBookAppointment,
  useOrganizations,
  useRescheduleAppointment,
} from '../../src/hooks/useAppointments';
import { ApiRequestError } from '../../src/api/client';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';

const TYPE_LABELS: Record<string, string> = {
  BLOOD_DONATION: 'Blood Donation',
  BLOOD_TEST: 'Blood Test',
  CONSULTATION: 'Consultation',
};

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
  const isSaving = isRescheduling ? rescheduleMutation.isPending : bookMutation.isPending;

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
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.error.message
          : isRescheduling
            ? 'Failed to reschedule appointment. Please try again.'
            : 'Failed to book appointment. Please try again.',
      );
    }
  };

  if (isLoading) {
    return (
      <BookingStep step={5} title="Review booking" subtitle="Loading your details…">
        <View />
      </BookingStep>
    );
  }

  if (hasLoadError || notFound || !slot || !organization) {
    return (
      <Screen>
        <GlassCard danger style={styles.blockingError}>
          <AlertCircle size={20} color={colors.onMuted.danger} />
          <AppText style={styles.blockingErrorText}>
            {hasLoadError
              ? "Couldn't load your booking details. Check your connection and try again."
              : 'This time slot is no longer available. Please choose another time.'}
          </AppText>
        </GlassCard>
        <View style={styles.blockingActions}>
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
          <AppButton variant="secondary" onPress={() => router.back()}>
            Back
          </AppButton>
        </View>
      </Screen>
    );
  }

  const start = new Date(slot.startAt);

  return (
    <BookingStep
      step={5}
      title={isRescheduling ? 'Review reschedule' : 'Review booking'}
      subtitle="Confirm your appointment details"
      nextLabel={isRescheduling ? 'Confirm reschedule' : 'Confirm appointment'}
      onNext={handleConfirm}
      nextDisabled={isSaving}
      nextLoading={isSaving}
    >
      <GlassCard tier="elevated">
        <View style={styles.detailStack}>
          <DetailRow
            icon={<Droplet size={18} color={colors.onMuted.primary} />}
            tint={colors.primaryMuted}
            label="DONATION TYPE"
            value={TYPE_LABELS[params.type] ?? params.type}
          />
          <View style={styles.divider} />
          <DetailRow
            icon={<Building2 size={18} color={colors.onMuted.secondary} />}
            tint={colors.secondaryMuted}
            label="LOCATION"
            value={organization.name}
            meta={organization.address}
          />
          <View style={styles.divider} />
          <DetailRow
            icon={<Calendar size={18} color={colors.onMuted.success} />}
            tint={colors.successMuted}
            label="DATE & TIME"
            value={`${start.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} · ${formatTime(slot.startAt)}`}
            meta={`Ends around ${formatTime(slot.endAt)}`}
          />
        </View>
      </GlassCard>

      {!isRescheduling && (
        <GlassCard style={styles.notesCard}>
          <AppTextInput
            label="Notes (optional)"
            placeholder="Anything the centre should know before you arrive"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notesInput}
          />
        </GlassCard>
      )}

      {error && (
        <GlassCard danger style={styles.errorCard}>
          <View style={styles.errorRow}>
            <AlertCircle size={16} color={colors.onMuted.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        </GlassCard>
      )}

      <AppText style={styles.terms}>
        By confirming, you agree to attend or to cancel at least 24 hours before the appointment.
      </AppText>
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

function DetailRow({
  icon,
  tint,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  meta?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.detailBody}>
        <AppText style={styles.detailLabel}>{label}</AppText>
        <AppText style={styles.detailValue}>{value}</AppText>
        {meta && <AppText style={styles.detailMeta}>{meta}</AppText>}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    detailStack: {
      gap: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    detailIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    detailBody: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 11,
      letterSpacing: 0.88,
      color: colors.textMuted,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    detailMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
    },

    notesCard: {
      marginTop: 14,
    },
    notesInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    errorCard: {
      marginTop: 14,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    terms: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 12,
    },

    blockingError: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    blockingErrorText: {
      flex: 1,
      fontSize: 14,
      color: colors.onMuted.danger,
    },
    blockingActions: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
  });
}
