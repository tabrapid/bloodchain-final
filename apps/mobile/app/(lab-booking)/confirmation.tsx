import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { AppButton, AppText, Badge, GlassCard, Screen } from '../../src/components';
import { useDonorLaboratoryAppointment } from '../../src/hooks/useLaboratory';
import { layout, spacing, translucentElevation, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/**
 * The booked appointment as the server stored it, read back by id.
 *
 * Reading it back rather than rendering the mutation's response is what makes
 * this a receipt: the test type shown here is the one persisted on the
 * appointment, which is the same row the laboratory's console reads.
 */
export default function LabBookingConfirmation() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ appointmentId: string }>();
  const { data: appointment, isLoading } = useDonorLaboratoryAppointment(params.appointmentId);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <LinearGradient colors={['#63C29B', '#3EA87E']} style={styles.successBadge}>
            <Check size={38} color="#FFFFFF" strokeWidth={3} />
          </LinearGradient>
        </View>

        <AppText style={styles.title}>{t('labBooking.confirmedTitle')}</AppText>
        <AppText muted style={styles.subtitle}>
          {t('labBooking.confirmedBody')}
        </AppText>

        {isLoading ? (
          <AppText muted>{t('common.loading')}</AppText>
        ) : appointment ? (
          <GlassCard tier="elevated" style={styles.detailsCard}>
            <View style={styles.refRow}>
              <AppText muted>{t('booking.referenceNumber')}</AppText>
              <AppText variant="heading" style={styles.refNumber}>
                {appointment.referenceNumber}
              </AppText>
            </View>

            <View style={styles.divider} />

            {appointment.testType ? (
              <View style={styles.detailRow}>
                <AppText muted style={styles.detailLabel}>
                  {t('labBooking.testType')}
                </AppText>
                <AppText style={styles.detailValue}>{appointment.testType.name}</AppText>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                {t('table.organization')}
              </AppText>
              <AppText style={styles.detailValue}>{appointment.organization.name}</AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                {t('table.date')}
              </AppText>
              <AppText style={styles.detailValue}>
                {formatDate(appointment.scheduledStart, 'full')}
              </AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                {t('table.time')}
              </AppText>
              <AppText style={styles.detailValue}>
                {formatTime(appointment.scheduledStart)} – {formatTime(appointment.scheduledEnd)}
              </AppText>
            </View>

            <View style={styles.detailRow}>
              <AppText muted style={styles.detailLabel}>
                {t('table.status')}
              </AppText>
              <Badge variant={appointment.status === 'CONFIRMED' ? 'success' : 'warning'}>
                {t(`status.appointment.${appointment.status}`)}
              </Badge>
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.reminderCard}>
          <AppText muted style={styles.reminderText}>
            {t('labBooking.arriveEarly')}
          </AppText>
        </GlassCard>
      </View>

      <View style={styles.footer}>
        <AppButton onPress={() => router.replace('/(app)/laboratory')}>
          {t('labBooking.viewMyTests')}
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.replace('/home' as const)}
          style={styles.homeButton}
        >
          {t('booking.backToApp')}
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
      elevation: translucentElevation(8),
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
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    detailLabel: {
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      flex: 1,
      textAlign: 'right',
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
