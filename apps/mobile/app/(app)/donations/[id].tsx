import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Droplet, Calendar, Clock, Building2, MapPin, AlertCircle } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen, ScreenHeader } from '../../../src/components';
import { useDonation } from '../../../src/hooks/useDonations';
import { layout, spacing, useTheme, ThemeColors } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';

export default function DonationDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string }>();
  const { data: donation, isLoading } = useDonation(params.id);

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
      case 'COMPLETED':
        return { bg: colors.successMuted, text: colors.onMuted.success };
      case 'CANCELLED':
      case 'ABORTED':
      case 'REJECTED':
        return { bg: colors.dangerMuted, text: colors.onMuted.danger };
      case 'IN_PROGRESS':
        return { bg: colors.warningMuted, text: colors.onMuted.warning };
      default:
        return { bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('donationHistory.detailTitle')} />
        <AppText>{t('common.loading')}</AppText>
      </Screen>
    );
  }

  if (!donation) {
    return (
      <Screen>
        <ScreenHeader title={t('donationHistory.detailTitle')} />
        <AppText>{t('donationHistory.notFound')}</AppText>
        <View style={styles.footer}>
          <AppButton variant="secondary" onPress={() => router.back()}>
            {t('common.back')}
          </AppButton>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('donationHistory.detailTitle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(donation.status).bg },
            ]}
          >
            <AppText style={[styles.statusText, { color: getStatusColor(donation.status).text }]}>
              {donation.status}
            </AppText>
          </View>
          <AppText muted style={styles.refNumber}>
            {donation.donationReference}
          </AppText>
        </View>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.mainInfo}>
            <View style={styles.iconContainer}>
              <Droplet size={32} color={colors.primary} />
            </View>
            <View style={styles.mainText}>
              <AppText variant="heading" style={styles.donationType}>
                {donation.donationType.replace('_', ' ')}
              </AppText>
              {donation.volumeMl && (
                <AppText style={styles.volume}>{donation.volumeMl} ml</AppText>
              )}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.detailsCard}>
          <AppText variant="heading" style={styles.sectionTitle}>
            {t('table.details')}
          </AppText>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Calendar size={18} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                {t('table.date')}
              </AppText>
              <AppText>
                {donation.collectionCompletedAt
                  ? formatDate(donation.collectionCompletedAt)
                  : formatDate(donation.createdAt)}
              </AppText>
            </View>
          </View>

          {donation.collectionStartedAt && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Clock size={18} color={colors.primary} />
              </View>
              <View style={styles.detailInfo}>
                <AppText muted style={styles.detailLabel}>
                  {t('table.time')}
                </AppText>
                <AppText>
                  {formatTime(donation.collectionStartedAt)}
                  {donation.collectionCompletedAt && ` - ${formatTime(donation.collectionCompletedAt)}`}
                </AppText>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Building2 size={18} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                {t('table.organization')}
              </AppText>
              <AppText>{donation.organization.name}</AppText>
              {donation.organization.address && (
                <View style={styles.addressRow}>
                  <MapPin size={12} color={colors.textMuted} />
                  <AppText muted style={styles.address}>
                    {donation.organization.address}
                  </AppText>
                </View>
              )}
            </View>
          </View>

          {donation.bloodType && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Droplet size={18} color={colors.primary} />
              </View>
              <View style={styles.detailInfo}>
                <AppText muted style={styles.detailLabel}>
                  {t('medical.bloodGroup')}
                </AppText>
                <AppText>
                  {donation.bloodType}
                  {donation.rhFactor && (donation.rhFactor === 'POSITIVE' ? '+' : '-')}
                </AppText>
              </View>
            </View>
          )}
        </GlassCard>

        {donation.nextDonationDate && (
          <Card style={styles.nextDateCard}>
            <AppText muted style={styles.nextDateLabel}>
              {t('donationHistory.nextDonationDate')}
            </AppText>
            <AppText variant="heading" style={styles.nextDateValue}>
              {formatDate(donation.nextDonationDate)}
            </AppText>
          </Card>
        )}

        {donation.cancellationReason && (
          <Card style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <AlertCircle size={18} color={colors.danger} />
              <AppText style={styles.reasonTitle}>
                {donation.status === 'CANCELLED' ? t('status.donation.CANCELLED') : t('table.reason')}
              </AppText>
            </View>
            <AppText muted style={styles.reasonText}>
              {donation.cancellationReason.replace('_', ' ')}
            </AppText>
          </Card>
        )}

        {donation.abortedReason && (
          <Card style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <AlertCircle size={18} color={colors.danger} />
              <AppText style={styles.reasonTitle}>{t('status.donation.ABORTED')}</AppText>
            </View>
            <AppText muted style={styles.reasonText}>
              {donation.abortedReason}
            </AppText>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton variant="secondary" onPress={() => router.back()}>
          {t('common.back')}
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
    header: {
      alignItems: 'center',
      marginBottom: layout.cardGap,
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
    summaryCard: {
      padding: spacing.lg,
      marginBottom: layout.cardGap,
      alignItems: 'center',
    },
    mainInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mainText: {
      alignItems: 'flex-start',
    },
    donationType: {
      textTransform: 'capitalize',
    },
    volume: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    detailsCard: {
      padding: spacing.lg,
      marginBottom: layout.cardGap,
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
      width: 36,
      height: 36,
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
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    address: {
      fontSize: 12,
      flex: 1,
    },
    nextDateCard: {
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: layout.cardGap,
      backgroundColor: colors.successMuted,
    },
    nextDateLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    nextDateValue: {
      color: colors.onMuted.success,
    },
    reasonCard: {
      padding: spacing.lg,
      backgroundColor: colors.dangerMuted,
      marginBottom: layout.cardGap,
    },
    reasonHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    reasonTitle: {
      fontWeight: '600',
      color: colors.onMuted.danger,
    },
    reasonText: {
      fontSize: 14,
      textTransform: 'capitalize',
    },
    footer: {
      paddingTop: spacing.lg,
    },
  });
}