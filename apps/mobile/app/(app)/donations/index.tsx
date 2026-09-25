import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { Droplet } from 'lucide-react-native';
import {
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  SkeletonRow,
  Stack,
  Stat,
  StatRow,
  Surface,
  iconSize,
  layout,
  space,
  useDesign,
  type StatusTone,
  useTabBarClearance,
} from '../../../src/design';
import { useMyDonations, useDonationStatistics } from '../../../src/hooks/useDonations';
import { type Donation } from '../../../src/api/donations';
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

/**
 * The badge carries the volume for a donation that actually happened -- that
 * is the number a donor looks for -- and falls back to the status for one that
 * did not, so a cancelled or aborted record is never presented in the same
 * shape as a completed one.
 */
function statusBadge(
  donation: Donation,
  t: (key: string) => string,
): { label: string; tone: StatusTone } {
  const status = t(`status.donation.${donation.status}`);
  if (donation.status === 'COMPLETED') {
    return donation.volumeMl
      ? { label: `${donation.volumeMl} ml`, tone: 'success' }
      : { label: status, tone: 'success' };
  }
  if (donation.status === 'IN_PROGRESS') return { label: status, tone: 'warning' };
  if (['CANCELLED', 'ABORTED', 'REJECTED'].includes(donation.status)) {
    return { label: status, tone: 'critical' };
  }
  return { label: status, tone: 'neutral' };
}

export default function DonationsScreen() {
  const tabBarClearance = useTabBarClearance();
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();
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
    ({ item }: { item: Donation }) => {
      const badge = statusBadge(item, t);
      const date = formatDate(item.collectionCompletedAt ?? item.createdAt, 'medium');
      return (
        <ListRow
          leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
          title={t(`medical.components.${item.donationType}`)}
          subtitle={`${date} · ${item.organization.name}`}
          trailing={<Badge label={badge.label} tone={badge.tone} />}
          accessibilityLabel={t('donationHistory.a11yRow', {
            type: t(`medical.components.${item.donationType}`),
            date,
          })}
          onPress={() => router.push(`/donations/${item.id}`)}
        />
      );
    },
    [colors, formatDate, t],
  );

  return (
    <Screen gutter={false}>
      <ScreenHeader title={t('donationHistory.title')} eyebrow={t('donationHistory.subtitle')} />
      <FlatList
        style={{ flex: 1 }}
        data={donations}
        renderItem={renderDonation}
        keyExtractor={(donation) => donation.id}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: tabBarClearance,
        }}
        // A list of rows with hairlines between them, not a column of cards:
        // twenty donations are one history, not twenty separate objects.
        ItemSeparatorComponent={() => <Divider inset />}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <Stack gap="lg" style={{ paddingBottom: space.md }}>
            {stats ? (
              <StatRow>
                <Stat
                  label={t('donationHistory.totalDonations')}
                  value={String(stats.totalDonations)}
                  tone="rose"
                />
                <Stat
                  label={t('donationHistory.volumeDonated')}
                  value={(stats.totalVolumeMl / 1000).toFixed(1)}
                  unit="L"
                />
                <Stat
                  label={t('status.donation.COMPLETED')}
                  value={String(stats.completedCount)}
                  tone="success"
                />
              </StatRow>
            ) : null}

            <SegmentedControl
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              accessibilityLabel={t('filters.all')}
            />

            <SectionHeader title={t('donationHistory.title')} />
          </Stack>
        }
        ListEmptyComponent={
          isLoading ? (
            <Surface>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </Surface>
          ) : isError ? (
            // An unreachable server used to render the same "no donations yet"
            // card as an account with none, which is a different fact.
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          ) : (
            <EmptyState
              title={t('donationHistory.empty')}
              description={
                filter === 'all'
                  ? t('donationHistory.emptyHint')
                  : t('donationHistory.emptyFiltered')
              }
              icon={({ size, color }) => <Droplet size={size} color={color} />}
              {...(filter === 'all'
                ? {
                    action: {
                      label: t('home.quickActionSchedule'),
                      onPress: () => router.push('/(booking)/select-type'),
                    },
                  }
                : { action: { label: t('filters.all'), onPress: () => setFilter('all') } })}
            />
          )
        }
      />
    </Screen>
  );
}
