import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Droplet, MapPin, ChevronRight } from 'lucide-react-native';
import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Badge,
  SkeletonCard,
} from '../../../src/components';
import { useMyDonations, useDonationStatistics } from '../../../src/hooks/useDonations';
import { type Donation } from '../../../src/api/donations';
import { spacing, radius, useTheme, ThemeColors } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';

type Filter = 'all' | 'completed' | 'cancelled';

// Keys, not words -- built at module load, resolved per render.
const FILTERS = [
  { labelKey: 'filters.all', value: 'all' },
  { labelKey: 'status.donation.COMPLETED', value: 'completed' },
  { labelKey: 'status.donation.CANCELLED', value: 'cancelled' },
] as const satisfies readonly { labelKey: string; value: Filter }[];

const FILTER_PARAMS: Record<Filter, Parameters<typeof useMyDonations>[0]> = {
  all: { past: true },
  completed: { status: 'COMPLETED', past: true },
  cancelled: { status: 'CANCELLED', past: true },
};

export default function DonationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');
  // Resolved here rather than in the module list above, because a label built
  // at module load is stuck in whatever language the app started in.
  const filterOptions = useMemo(
    () => FILTERS.map(({ labelKey, value }) => ({ value, label: t(labelKey) })),
    [t],
  );

  const { data, isLoading, isError, refetch, isRefetching } = useMyDonations(FILTER_PARAMS[filter]);
  const { data: stats } = useDonationStatistics();

  const donations: Donation[] = data?.data ?? [];

  const renderDonation = useCallback(
    ({ item }: { item: Donation }) => <DonationRow donation={item} />,
    [],
  );

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('donationHistory.title')} subtitle={t('donationHistory.subtitle')} />
      <FlatList
        style={styles.list}
        data={donations}
        renderItem={renderDonation}
        keyExtractor={(donation) => donation.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {stats && (
              <View style={styles.summaryRow}>
                <SummaryTile value={String(stats.totalDonations)} label={t('donationHistory.totalDonations')} />
                <SummaryTile
                  value={`${(stats.totalVolumeMl / 1000).toFixed(1)}L`}
                  label={t('donationHistory.volumeDonated')}
                />
                <SummaryTile value={String(stats.completedCount)} label={t('status.donation.COMPLETED')} />
              </View>
            )}

            <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} />

            <SectionHeader>{t('donationHistory.title')}</SectionHeader>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : isError ? (
            // An unreachable server used to render the same "no donations yet"
            // card as an account with none, which is a different fact.
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              title={t('donationHistory.empty')}
              description={
                filter === 'all'
                  ? t('donationHistory.emptyHint')
                  : t('donationHistory.emptyFiltered')
              }
            />
          )
        }
      />
    </Screen>
  );
}

function SummaryTile({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GlassCard tier="elevated" style={styles.summaryTile}>
      <AppText style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText style={styles.summaryLabel}>{label}</AppText>
    </GlassCard>
  );
}

/**
 * The badge slot carries the volume for a donation that actually happened --
 * that is the number a donor looks for -- and falls back to the status for
 * one that did not, so a cancelled or aborted record is never presented in
 * the same shape as a completed one.
 */
function statusBadge(
  donation: Donation,
  t: (key: string) => string,
): { label: string; variant: 'success' | 'warning' | 'danger' | 'default' } {
  const status = t(`status.donation.${donation.status}`);
  if (donation.status === 'COMPLETED') {
    return donation.volumeMl
      ? { label: `${donation.volumeMl} ml`, variant: 'success' }
      : { label: status, variant: 'success' };
  }
  if (donation.status === 'IN_PROGRESS') return { label: status, variant: 'warning' };
  if (['CANCELLED', 'ABORTED', 'REJECTED'].includes(donation.status)) {
    return { label: status, variant: 'danger' };
  }
  return { label: status, variant: 'default' };
}

function DonationRow({ donation }: { donation: Donation }) {
  const { t, formatDate } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const badge = statusBadge(donation, t);
  const date = formatDate(donation.collectionCompletedAt ?? donation.createdAt, 'medium');

  return (
    <Pressable
      onPress={() => router.push(`/donations/${donation.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={t('donationHistory.a11yRow', {
        type: t(`medical.components.${donation.donationType}`),
        date,
      })}
    >
      <GlassCard style={styles.rowCard}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Droplet size={18} color={colors.primary} fill="rgba(216, 83, 96, 0.4)" />
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <AppText style={styles.rowTitle} numberOfLines={1}>
                {t(`medical.components.${donation.donationType}`)}
              </AppText>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </View>
            <AppText style={styles.rowDate}>{date}</AppText>
            <View style={styles.rowOrgLine}>
              <MapPin size={10} color={colors.textMuted} />
              <AppText style={styles.rowOrg} numberOfLines={1}>
                {donation.organization.name}
              </AppText>
            </View>
          </View>

          <ChevronRight size={16} color={colors.textSubtle} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1 },
    listContent: {
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    header: {
      gap: spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryTile: {
      flex: 1,
      padding: 14,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.84,
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    skeletons: {
      gap: spacing.sm,
    },

    rowCard: {
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(216, 83, 96, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowBody: {
      flex: 1,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 4,
    },
    rowTitle: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    rowDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    rowOrgLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 2,
    },
    rowOrg: {
      flex: 1,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}
