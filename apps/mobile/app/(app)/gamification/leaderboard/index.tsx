import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import { useLeaderboard, useUserRank } from '../../../../src/hooks/useGamification';
import {
  Screen,
  GlassCard,
  Avatar,
  Badge,
  ScreenHeader,
  SegmentedControl,
  SkeletonCard,
} from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';
import type { LeaderboardEntry } from '../../../../src/api/gamification';

/** Gold / silver / bronze, and the podium bar gradient for each. */
const PODIUM_RING = ['#E5B86D', '#9BA8B2', '#CD7F32'] as const;
const PODIUM_GRADIENT: readonly [string, string][] = [
  ['#E5B86D', '#D4A043'],
  ['#9BA8B2', '#7A8B96'],
  ['#CD7F32', '#A6642A'],
];
const PODIUM_HEIGHT = [70, 50, 40] as const;
/** Rendered 2nd, 1st, 3rd so the tallest bar sits in the middle. */
const PODIUM_ORDER = [1, 0, 2] as const;

type TimeRange = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH';

const TIME_RANGES = [
  { label: 'All Time', value: 'ALL_TIME' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'This Month', value: 'THIS_MONTH' },
] as const satisfies readonly { label: string; value: TimeRange }[];

const PAGE_SIZE = 10;

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('ALL_TIME');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: leaderboard, isLoading, refetch } = useLeaderboard(timeRange, currentPage, PAGE_SIZE);
  const { data: userRank, refetch: refetchRank } = useUserRank(timeRange);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchRank()]);
    setRefreshing(false);
  }, [refetch, refetchRank]);

  const handleTimeRangeChange = React.useCallback((range: TimeRange) => {
    setTimeRange(range);
    setCurrentPage(1);
  }, []);

  const entries = leaderboard?.entries ?? [];
  const showPodium = currentPage === 1 && entries.length >= 3;
  const rows = showPodium ? entries.slice(3) : entries;

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Leaderboard" subtitle={rangeSubtitle(timeRange)} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <SegmentedControl
          options={TIME_RANGES}
          value={timeRange}
          onChange={handleTimeRangeChange}
        />

        {isLoading && !leaderboard ? (
          <View style={styles.list}>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : (
          <>
            {showPodium && (
              <View style={styles.podium}>
                {PODIUM_ORDER.map((place) => (
                  <PodiumColumn key={entries[place]!.userId} place={place} entry={entries[place]!} />
                ))}
              </View>
            )}

            {userRank && (
              <GlassCard tier="elevated">
                <View style={styles.rankRow}>
                  <View>
                    <AppText style={styles.rankLabel}>YOUR RANK</AppText>
                    <View style={styles.rankValueRow}>
                      <AppText style={styles.rankValue}>#{userRank.rank}</AppText>
                      <AppText style={styles.rankTotal}>of {userRank.total}</AppText>
                    </View>
                  </View>
                  <View style={styles.rankStats}>
                    <View style={styles.rankStat}>
                      <AppText style={styles.rankStatValue}>{userRank.xp.toLocaleString()}</AppText>
                      <AppText style={styles.rankStatLabel}>Total XP</AppText>
                    </View>
                    <View style={styles.rankStat}>
                      <AppText style={styles.rankStatValue}>Lv.{userRank.level}</AppText>
                      <AppText style={styles.rankStatLabel}>Level</AppText>
                    </View>
                  </View>
                </View>
              </GlassCard>
            )}

            <View style={styles.list}>
              {rows.map((entry) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  isMe={userRank?.rank === entry.rank}
                />
              ))}

              {entries.length === 0 && (
                <GlassCard style={styles.emptyCard}>
                  <AppText style={styles.emptyText}>No leaderboard data available yet</AppText>
                </GlassCard>
              )}
            </View>

            {leaderboard && leaderboard.total > currentPage * PAGE_SIZE && (
              <Pressable
                style={({ pressed }) => [styles.loadMore, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setCurrentPage((p) => p + 1)}
              >
                <AppText style={styles.loadMoreLabel}>Load More</AppText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function rangeSubtitle(range: TimeRange): string {
  const now = new Date();
  if (range === 'THIS_MONTH') {
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (range === 'THIS_YEAR') return String(now.getFullYear());
  return 'Top donors of all time';
}

function PodiumColumn({ place, entry }: { place: number; entry: LeaderboardEntry }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const isFirst = place === 0;

  return (
    <View style={styles.podiumColumn}>
      <View style={styles.podiumAvatar}>
        <Avatar name={entry.displayName} size={isFirst ? 58 : 48} ring={PODIUM_RING[place]} />
        {isFirst && (
          <View style={styles.podiumTrophy}>
            <Trophy size={14} color={PODIUM_RING[0]} />
          </View>
        )}
      </View>
      <AppText numberOfLines={1} style={styles.podiumName}>
        {entry.displayName.split(' ')[0]}
      </AppText>
      <LinearGradient
        colors={PODIUM_GRADIENT[place]!}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.podiumBar, { height: PODIUM_HEIGHT[place] }]}
      >
        <AppText style={[styles.podiumRank, { fontSize: isFirst ? 22 : place === 1 ? 18 : 16 }]}>
          {place + 1}
        </AppText>
      </LinearGradient>
    </View>
  );
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <GlassCard
      tier={isMe ? 'elevated' : 'standard'}
      style={[styles.rowCard, isMe && styles.rowCardMe]}
    >
      <View style={styles.row}>
        <AppText style={[styles.rowRank, isMe && { color: colors.primary }]}>#{entry.rank}</AppText>
        <Avatar name={entry.displayName} size={36} ring={isMe ? colors.primary : undefined} />
        <View style={styles.rowInfo}>
          <View style={styles.rowNameLine}>
            <AppText numberOfLines={1} style={[styles.rowName, isMe && { fontWeight: '700' }]}>
              {entry.displayName}
            </AppText>
            {isMe && <Badge variant="primary">You</Badge>}
          </View>
          <AppText style={styles.rowMeta}>
            Lv.{entry.level} · {entry.donationCount} donations
          </AppText>
        </View>
        <AppText style={[styles.rowXp, isMe && { color: colors.primary }]}>
          {entry.xp.toLocaleString()} XP
        </AppText>
      </View>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: {
      gap: 12,
      paddingBottom: spacing.xl,
    },

    podium: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: 4,
    },
    podiumColumn: {
      flex: 1,
      alignItems: 'center',
    },
    podiumAvatar: {
      position: 'relative',
    },
    podiumTrophy: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.background,
      borderRadius: radius.pill,
      padding: 2,
    },
    podiumName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      marginTop: 6,
      textAlign: 'center',
    },
    podiumBar: {
      width: '100%',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      marginTop: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    podiumRank: {
      fontWeight: '800',
      color: '#FFFFFF',
    },

    rankRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rankLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: colors.textMuted,
    },
    rankValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      marginTop: 2,
    },
    rankValue: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.primary,
    },
    rankTotal: {
      fontSize: 13,
      color: colors.textMuted,
    },
    rankStats: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    rankStat: {
      alignItems: 'flex-end',
    },
    rankStatValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    rankStatLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },

    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowCard: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    rowCardMe: {
      borderColor: 'rgba(216, 83, 96, 0.35)',
    },
    rowRank: {
      width: 28,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textMuted,
    },
    rowInfo: {
      flex: 1,
    },
    rowNameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    rowMeta: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    rowXp: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },

    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },

    loadMore: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    loadMoreLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
