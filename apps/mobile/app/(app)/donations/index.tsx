import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Droplet, MapPin, ChevronRight } from 'lucide-react-native';
import {
  AppText,
  EmptyState,
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

type Filter = 'all' | 'completed' | 'cancelled';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
] as const satisfies readonly { label: string; value: Filter }[];

const FILTER_PARAMS: Record<Filter, Parameters<typeof useMyDonations>[0]> = {
  all: { past: true },
  completed: { status: 'COMPLETED', past: true },
  cancelled: { status: 'CANCELLED', past: true },
};

export default function DonationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, refetch, isRefetching } = useMyDonations(FILTER_PARAMS[filter]);
  const { data: stats } = useDonationStatistics();

  const donations: Donation[] = data?.data ?? [];

  const renderDonation = useCallback(
    ({ item }: { item: Donation }) => <DonationRow donation={item} />,
    [],
  );

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Donation History" subtitle="All your previous donations" />
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
                <SummaryTile value={String(stats.totalDonations)} label="Total donations" />
                <SummaryTile
                  value={`${(stats.totalVolumeMl / 1000).toFixed(1)}L`}
                  label="Volume donated"
                />
                <SummaryTile value={String(stats.completedCount)} label="Completed" />
              </View>
            )}

            <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />

            <SectionHeader>History</SectionHeader>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No donations yet"
              description={
                filter === 'all'
                  ? 'Your donation history will appear here once you complete a donation.'
                  : `No ${filter} donations found.`
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
function statusBadge(donation: Donation): { label: string; variant: 'success' | 'warning' | 'danger' | 'default' } {
  if (donation.status === 'COMPLETED') {
    return donation.volumeMl
      ? { label: `${donation.volumeMl} ml`, variant: 'success' }
      : { label: 'Completed', variant: 'success' };
  }
  if (donation.status === 'IN_PROGRESS') return { label: 'In progress', variant: 'warning' };
  if (['CANCELLED', 'ABORTED', 'REJECTED'].includes(donation.status)) {
    return { label: donation.status.toLowerCase(), variant: 'danger' };
  }
  return { label: donation.status.replace(/_/g, ' ').toLowerCase(), variant: 'default' };
}

function DonationRow({ donation }: { donation: Donation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const badge = statusBadge(donation);
  const date = new Date(donation.collectionCompletedAt ?? donation.createdAt).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' },
  );

  return (
    <Pressable
      onPress={() => router.push(`/donations/${donation.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${donation.donationType.replace(/_/g, ' ')} donation on ${date}`}
    >
      <GlassCard style={styles.rowCard}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Droplet size={18} color={colors.primary} fill="rgba(216, 83, 96, 0.4)" />
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <AppText style={styles.rowTitle} numberOfLines={1}>
                {donation.donationType.replace(/_/g, ' ')}
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
