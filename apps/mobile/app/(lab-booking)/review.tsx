import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Building2, Calendar, FlaskConical } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  AppButton,
  AppText,
  AppTextInput,
  BookingStep,
  GlassCard,
  Screen,
} from '../../src/components';
import {
  laboratoriesOfferingTestType,
  useBookLaboratoryAppointment,
  useLaboratories,
  useLaboratorySlots,
  useTestTypes,
} from '../../src/hooks/useLaboratory';
import { ApiRequestError } from '../../src/api/client';
import { layout, radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/**
 * Step 5: what the donor is about to book, then `POST /laboratory-appointments`.
 *
 * The three choices are re-read from their own queries rather than carried
 * through the route as display strings, so what is shown here is the same data
 * the request is built from -- and the test type, the thing this whole flow
 * exists to carry, is named on screen before the donor confirms it.
 */
export default function ReviewLabBooking() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    testTypeId: string;
    laboratoryId: string;
    date: string;
    slotId: string;
  }>();

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: testTypes = [],
    isLoading: testTypesLoading,
    isError: testTypesError,
    refetch: refetchTestTypes,
  } = useTestTypes();
  const {
    data: laboratories = [],
    isLoading: labsLoading,
    isError: labsError,
    refetch: refetchLabs,
  } = useLaboratories();
  const {
    data: slots = [],
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useLaboratorySlots(params.laboratoryId, params.testTypeId, params.date);

  const testType = testTypes.find((type) => type.id === params.testTypeId);
  const laboratory = laboratoriesOfferingTestType(laboratories, params.testTypeId).find(
    (org) => org.id === params.laboratoryId,
  );
  const slot = slots.find((candidate) => candidate.id === params.slotId);

  const isLoading = testTypesLoading || labsLoading || slotsLoading;
  const hasLoadError = testTypesError || labsError || slotsError;
  const notFound = !isLoading && !hasLoadError && (!testType || !laboratory || !slot);

  const bookMutation = useBookLaboratoryAppointment();

  const handleConfirm = async () => {
    setError(null);
    try {
      const appointment = await bookMutation.mutateAsync({
        laboratoryId: params.laboratoryId,
        testTypeId: params.testTypeId,
        slotId: params.slotId,
        notes: notes.trim() || undefined,
      });
      router.replace({
        pathname: '/(lab-booking)/confirmation',
        params: { appointmentId: appointment.id },
      });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.error.message : t('labBooking.bookFailed'),
      );
    }
  };

  if (isLoading) {
    return (
      <BookingStep
        step={5}
        title={t('booking.review')}
        subtitle={t('booking.loadingDetails')}
        onClose={() => router.replace('/(app)/laboratory')}
      >
        <View />
      </BookingStep>
    );
  }

  if (hasLoadError || notFound || !testType || !laboratory || !slot) {
    return (
      <Screen>
        <GlassCard danger style={styles.blockingError}>
          <AlertCircle size={20} color={colors.onMuted.danger} />
          <AppText style={styles.blockingErrorText}>
            {hasLoadError ? t('booking.detailsFailed') : t('booking.slotTaken')}
          </AppText>
        </GlassCard>
        <View style={styles.blockingActions}>
          {hasLoadError && (
            <AppButton
              onPress={() => {
                refetchTestTypes();
                refetchLabs();
                refetchSlots();
              }}
            >
              {t('common.retry')}
            </AppButton>
          )}
          <AppButton variant="secondary" onPress={() => router.back()}>
            {t('common.back')}
          </AppButton>
        </View>
      </Screen>
    );
  }

  return (
    <BookingStep
      step={5}
      title={t('booking.review')}
      subtitle={t('booking.confirmDetails')}
      nextLabel={t('labBooking.confirmBooking')}
      onNext={handleConfirm}
      onClose={() => router.replace('/(app)/laboratory')}
      nextDisabled={bookMutation.isPending}
      nextLoading={bookMutation.isPending}
    >
      <GlassCard tier="elevated">
        <View style={styles.detailStack}>
          <DetailRow
            icon={<FlaskConical size={18} color={colors.onMuted.secondary} />}
            tint={colors.secondaryMuted}
            label={t('labBooking.testType')}
            value={testType.name}
            meta={t('units.parametersTested', { count: testType.parameters.length })}
          />
          <View style={styles.divider} />
          <DetailRow
            icon={<Building2 size={18} color={colors.onMuted.primary} />}
            tint={colors.primaryMuted}
            label={t('table.location')}
            value={laboratory.name}
            meta={laboratory.address ?? undefined}
          />
          <View style={styles.divider} />
          <DetailRow
            icon={<Calendar size={18} color={colors.onMuted.success} />}
            tint={colors.successMuted}
            label={t('booking.dateAndTime')}
            value={`${formatDate(slot.startAt, 'medium')} · ${formatTime(slot.startAt)}`}
            meta={t('booking.endsAround', { time: formatTime(slot.endAt) })}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.notesCard}>
        <AppTextInput
          label={t('booking.notesOptional')}
          placeholder={t('booking.notesHint')}
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notesInput}
        />
      </GlassCard>

      {error && (
        <GlassCard danger style={styles.errorCard}>
          <View style={styles.errorRow}>
            <AlertCircle size={16} color={colors.onMuted.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        </GlassCard>
      )}

      <AppText style={styles.terms}>{t('labBooking.fastingHint')}</AppText>
    </BookingStep>
  );
}

function DetailRow({
  icon,
  tint,
  label,
  value,
  meta,
}: {
  icon: ReactNode;
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
        {meta ? <AppText style={styles.detailMeta}>{meta}</AppText> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    blockingError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    blockingErrorText: {
      flex: 1,
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    blockingActions: {
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    detailStack: {
      gap: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    detailIcon: {
      width: 38,
      height: 38,
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
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
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
      backgroundColor: colors.border,
    },
    notesCard: {
      marginTop: layout.cardGap,
    },
    notesInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    errorCard: {
      marginTop: layout.cardGap,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    terms: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
}
