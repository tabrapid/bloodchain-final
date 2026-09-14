import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import {
  Calendar,
  Clock,
  MapPin,
  Droplet,
  Hash,
  AlertCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  AppTextInput,
  Badge,
  GlassCard,
  Screen,
} from '../../../src/components';
import { useAppointment, useCancelAppointment } from '../../../src/hooks/useAppointments';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../src/theme';
import type { BadgeProps } from '../../../src/components/Badge';
import { useTranslation } from '../../../src/i18n';

/**
 * What the donor should do before arriving. This is the same advice every
 * blood service publishes and does not vary per appointment, so it is content
 * rather than data -- the backend has no per-appointment preparation field to
 * read it from.
 */
// Catalogue keys, resolved at render: there is no locale at module load.
const PREPARATION = [
  'medical.preparation.hydrate',
  'medical.preparation.eatWell',
  'medical.preparation.noAlcohol',
  'medical.preparation.bringId',
  'medical.preparation.wearComfortable',
];

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  CONFIRMED: 'success',
  PENDING: 'warning',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  COMPLETED: 'primary',
};

export default function AppointmentDetail() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string }>();
  const { data: appointment, isLoading } = useAppointment(params.id);

  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cancelMutation = useCancelAppointment();

  const isOpen = !!appointment && ['PENDING', 'CONFIRMED'].includes(appointment.status);

  const handleCancel = () => {
    if (!showCancelReason) {
      setShowCancelReason(true);
      return;
    }

    Alert.alert(t('appointment.cancelTitle'), t('appointment.cancelConfirmBody'), [
      { text: t('appointment.cancelKeep'), style: 'cancel' },
      {
        text: t('appointment.cancelConfirm'),
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await cancelMutation.mutateAsync({
              id: params.id,
              input: { reason: cancelReason.trim() || undefined },
            });
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : t('appointment.cancelFailed'));
          }
        },
      },
    ]);
  };

  const handleReschedule = () => {
    if (!appointment) return;
    // Reschedule keeps the same organization and appointment type -- only
    // the date/time change -- so this skips straight to date selection
    // instead of re-running the full new-booking flow.
    router.push({
      pathname: '/(booking)/date' as const,
      params: {
        organizationId: appointment.organization.id,
        type: appointment.appointmentType,
        rescheduleAppointmentId: params.id,
      },
    });
  };

  if (isLoading || !appointment) {
    return (
      <Screen>
        <BackLink />
        <AppText style={styles.title}>
          {isLoading ? t('common.loading') : t('appointment.notFound')}
        </AppText>
        {!isLoading && (
          <View style={styles.footer}>
            <AppButton variant="secondary" onPress={() => router.back()}>
              {t('common.back')}
            </AppButton>
          </View>
        )}
      </Screen>
    );
  }

  const start = new Date(appointment.scheduledStart);
  const end = new Date(appointment.scheduledEnd);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <BackLink />
        <View style={styles.titleRow}>
          <AppText style={styles.title}>
            {toTitleCase(appointment.appointmentType)} Donation
          </AppText>
          <Badge variant={STATUS_VARIANT[appointment.status] ?? 'default'}>
            {appointment.status.replace(/_/g, ' ')}
          </Badge>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard tier="elevated">
          <View style={styles.detailStack}>
            <DetailRow
              icon={<Calendar size={18} color={colors.success} />}
              tint={`${colors.success}26`}
              label={t('table.date')}
              value={start.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
            <View style={styles.divider} />
            <DetailRow
              icon={<Clock size={18} color={colors.secondary} />}
              tint={`${colors.secondary}26`}
              label={t('table.time')}
              value={`${formatTime(start)} — approx. ${durationMin} min`}
            />
            <View style={styles.divider} />
            <DetailRow
              icon={<MapPin size={18} color={colors.primary} />}
              tint="rgba(216, 83, 96, 0.12)"
              label={t('table.location')}
              value={appointment.organization.name}
              meta={appointment.organization.address}
            />
            <View style={styles.divider} />
            <DetailRow
              icon={<Droplet size={18} color={colors.primary} />}
              tint="rgba(216, 83, 96, 0.12)"
              label={t('table.type')}
              value={toTitleCase(appointment.appointmentType)}
            />
          </View>
        </GlassCard>

        {isOpen && (
          <GlassCard>
            <AppText style={styles.cardTitle}>{t('appointment.preparation')}</AppText>
            {PREPARATION.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <AppText style={styles.tipText}>{t(tip)}</AppText>
              </View>
            ))}
          </GlassCard>
        )}

        <GlassCard style={styles.compactCard}>
          <View style={styles.compactRow}>
            <View style={styles.compactIcon}>
              <Hash size={16} color={colors.secondary} />
            </View>
            <View style={styles.compactBody}>
              <AppText style={styles.compactTitle}>{t('booking.referenceNumber')}</AppText>
              <AppText style={styles.compactMeta}>{appointment.referenceNumber}</AppText>
            </View>
          </View>
        </GlassCard>

        {appointment.notes && (
          <GlassCard>
            <AppText style={styles.cardTitle}>{t('table.notes')}</AppText>
            <AppText style={styles.bodyText}>{appointment.notes}</AppText>
          </GlassCard>
        )}

        {appointment.cancellationReason && (
          <GlassCard danger>
            <View style={styles.noticeHeader}>
              <XCircle size={18} color={colors.onMuted.danger} />
              <AppText style={styles.noticeTitle}>{t('appointment.cancelledNotice')}</AppText>
            </View>
            <AppText style={styles.bodyText}>{appointment.cancellationReason}</AppText>
          </GlassCard>
        )}

        {error && (
          <GlassCard danger>
            <View style={styles.noticeHeader}>
              <AlertCircle size={18} color={colors.onMuted.danger} />
              <AppText style={styles.noticeTitle}>{error}</AppText>
            </View>
          </GlassCard>
        )}

        {showCancelReason && (
          <GlassCard>
            <AppTextInput
              label={t('appointment.cancelReason')}
              placeholder={t('appointment.cancelReasonHint')}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
          </GlassCard>
        )}

        <View style={styles.actions}>
          {isOpen ? (
            <>
              <AppButton variant="secondary" onPress={handleReschedule} style={styles.action}>
                {t('appointment.reschedule')}
              </AppButton>
              <AppButton
                variant="ghost"
                onPress={handleCancel}
                loading={cancelMutation.isPending}
                style={styles.action}
              >
                {showCancelReason ? t('actions.confirm') : t('actions.cancel')}
              </AppButton>
            </>
          ) : (
            <AppButton variant="secondary" onPress={() => router.back()} style={styles.action}>
              {t('common.back')}
            </AppButton>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function BackLink() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t('auth.a11y.goBack')}
      style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.6 : 1 }]}
    >
      <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
      <AppText style={styles.backLabel}>{t('actions.back')}</AppText>
    </Pressable>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  meta?: string;
}

function DetailRow({ icon, tint, label, value, meta }: DetailRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.detailBody}>
        <AppText style={styles.detailLabel}>{label.toUpperCase()}</AppText>
        <AppText style={styles.detailValue}>{value}</AppText>
        {meta && <AppText style={styles.detailMeta}>{meta}</AppText>}
      </View>
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      marginBottom: layout.cardGap,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
      paddingRight: spacing.sm,
    },
    backLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.48,
      color: colors.text,
    },
    content: {
      gap: layout.cardGap,
      paddingBottom: spacing.xl,
    },

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
      letterSpacing: 0.66,
      color: colors.textMuted,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginTop: 1,
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

    cardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: layout.cardGap,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    tipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginTop: 6,
      flexShrink: 0,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
    },
    bodyText: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
    },

    compactCard: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    compactIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${colors.secondary}26`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactBody: {
      flex: 1,
    },
    compactTitle: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    compactMeta: {
      fontSize: 12,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },

    noticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    noticeTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.onMuted.danger,
    },

    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    action: {
      flex: 1,
    },
    footer: {
      marginTop: spacing.lg,
    },
  });
}
