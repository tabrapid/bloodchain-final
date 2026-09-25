import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useLeaderboard, useUserRank } from '../../../../src/hooks/useGamification';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  EmptyState,
  Row,
  ScreenHeader,
  ScrollScreen,
  SegmentedControl,
  Skeleton,
  Stack,
  Surface,
  Text,
  ValueText,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../../../src/design';
import type { LeaderboardEntry } from '../../../../src/api/gamification';
import { useTranslation } from '../../../../src/i18n';

type TimeRange = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH';

const TIME_RANGES = [
  // Keys, not words: built at module load, where there is no locale.
  { labelKey: 'gamification.allTime', value: 'ALL_TIME' },
  { labelKey: 'filters.thisYear', value: 'THIS_YEAR' },
  { labelKey: 'filters.thisMonth', value: 'THIS_MONTH' },
] as const satisfies readonly { labelKey: string; value: TimeRange }[];

const PAGE_SIZE = 10;

/**
 * The leaderboard, rebuilt for V2.
 *
 * V1 opened with a three-column podium: gold, silver and bronze gradient bars
 * of descending height, the winner's avatar ringed in gold with a trophy
 * pinned to it. That is a game's results screen, and the thing being ranked
 * here is how much blood people gave.
 *
 * The same three donors are still first, second and third -- ranking is the
 * screen's purpose and it is not being hidden -- but they are rows in a list
 * with a quiet marker, and the donor's own position is a plain surface rather
 * than a trophy case.
 *
 * Four strings here were English literals: `of {total}`, `Lv.{n}`,
 * `{n} donations`, and `{n} XP`. `toLocaleString()` with no locale also read
 * the device's rather than the app's, so a donor with an English phone saw
 * "1,250" inside an Uzbek screen where "1 250" is correct.
 */
export default function LeaderboardScreen() {
  const { t, formatMonth, formatNumber } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL_TIME');
  const [currentPage, setCurrentPage] = useState(1);

  // Resolved per render rather than in TIME_RANGES above, where there is no
  // locale yet -- a label built at module load is stuck in one language.
  const rangeOptions = useMemo(
    () => TIME_RANGES.map(({ labelKey, value }) => ({ value, label: t(labelKey) })),
    [t],
  );

  const { data: leaderboard, isPending, refetch, isRefetching } = useLeaderboard(
    timeRange,
    currentPage,
    PAGE_SIZE,
  );
  const { data: userRank, refetch: refetchRank } = useUserRank(timeRange);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
    setCurrentPage(1);
  }, []);

  const entries = leaderboard?.entries ?? [];

  const subtitle = (() => {
    const now = new Date();
    // formatMonth already carries the year, so "September 2026" comes back
    // spelled and ordered for the active locale rather than assembled here.
    if (timeRange === 'THIS_MONTH') return formatMonth(now);
    if (timeRange === 'THIS_YEAR') return String(now.getFullYear());
    return t('gamification.topDonorsAllTime');
  })();

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('gamification.leaderboard')}
          eyebrow={subtitle}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
        void refetchRank();
      }}
    >
      <Stack gap="xl">
        <SegmentedControl
          options={rangeOptions}
          value={timeRange}
          onChange={handleTimeRangeChange}
          accessibilityLabel={t('healthTrends.timeRange')}
        />

        {userRank ? (
          <Surface>
            <Row gap="lg">
              <View style={{ gap: 2 }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('gamification.yourRank')}
                </Text>
                <ValueText variant="h1">
                  {t('gamification.rankOf', { rank: userRank.rank, total: userRank.total })}
                </ValueText>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
                <Text variant="label" tone="secondary">
                  {t('gamification.xpValue', { xp: formatNumber(userRank.xp) })}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {t('gamification.levelShort', { level: userRank.level })}
                </Text>
              </View>
            </Row>
          </Surface>
        ) : null}

        {isPending && !leaderboard ? (
          <Stack gap="md">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </Stack>
        ) : entries.length === 0 ? (
          <EmptyState
            title={t('gamification.leaderboardEmpty')}
            icon={({ size, color }) => <Trophy size={size} color={color} />}
          />
        ) : (
          <Surface padded="lg">
            {entries.map((entry, index) => (
              <View key={entry.userId}>
                {index > 0 ? <Divider /> : null}
                <LeaderboardRow entry={entry} isMe={userRank?.rank === entry.rank} />
              </View>
            ))}
          </Surface>
        )}

        {leaderboard && leaderboard.total > currentPage * PAGE_SIZE ? (
          <Button
            label={t('gamification.loadMore')}
            variant="secondary"
            onPress={() => setCurrentPage((page) => page + 1)}
          />
        ) : null}
      </Stack>
    </ScrollScreen>
  );
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { t, formatNumber } = useTranslation();
  const { colors } = useDesign();

  return (
    <View
      accessible
      accessibilityLabel={`${t('gamification.rankOf', { rank: entry.rank, total: '' }).trim()} ${
        entry.displayName
      }. ${t('gamification.xpValue', { xp: formatNumber(entry.xp) })}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      {/* The top three are marked, not staged: a filled rose disc rather than
          a gold gradient podium bar. */}
      <View
        style={{
          width: 32,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
          borderRadius: radius.full,
          backgroundColor: entry.rank <= 3 ? colors.rose.soft : 'transparent',
        }}
      >
        <Text variant="label" tone={entry.rank <= 3 ? 'rose' : 'tertiary'}>
          {entry.rank}
        </Text>
      </View>

      <Avatar name={entry.displayName} size={36} {...(isMe ? { ring: 'rose' as const } : {})} />

      <View style={{ flex: 1, gap: 2 }}>
        <Row gap="sm">
          <Text variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
            {entry.displayName}
          </Text>
          {isMe ? <Badge label={t('sos.you')} tone="rose" /> : null}
        </Row>
        <Text variant="caption" tone="tertiary">
          {`${t('gamification.levelShort', { level: entry.level })} · ${t('units.donations', {
            count: entry.donationCount,
          })}`}
        </Text>
      </View>

      <Text variant="label" tone={isMe ? 'rose' : 'secondary'}>
        {t('gamification.xpValue', { xp: formatNumber(entry.xp) })}
      </Text>

      {entry.rank === 1 ? <Trophy size={iconSize.sm} color={colors.warning.base} /> : null}
    </View>
  );
}
