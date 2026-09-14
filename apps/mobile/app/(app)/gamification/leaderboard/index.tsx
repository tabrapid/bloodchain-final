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
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';
import type { LeaderboardEntry } from '../../../../src/api/gamification';
import { useTranslation } from '../../../../src/i18n';

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
  // Keys, not words: built at module load, where there is no locale.
  { labelKey: 'gamification.allTime', value: 'ALL_TIME' },
  { labelKey: 'filters.thisYear', value: 'THIS_YEAR' },
  { labelKey: 'filters.thisMonth', value: 'THIS_MONTH' },
] as const satisfies readonly { labelKey: string; value: TimeRange }[];

const PAGE_SIZE = 10;

export default function LeaderboardScreen() {
  const { t, formatMonth } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('ALL_TIME');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);
  // Resolved per render rather than in TIME_RANGES above, where there is no
  // locale yet -- a label built at module load is stuck in one language.
  const rangeOptions = React.useMemo(
    () => TIME_RANGES.map(({ labelKey, value }) => ({ value, label: t(labelKey) })),
    [t],
  );

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
      <ScreenHeader title={t('gamification.leaderboard')} subtitle={rangeSubtitle(timeRange, t, formatMonth)} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <SegmentedControl
          options={rangeOptions}
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
                    <AppText style={styles.rankLabel}>{t('gamification.yourRank')}</AppText>
                    <View style={styles.rankValueRow}>
                      <AppText style={styles.rankValue}>#{userRank.rank}</AppText>
                      <AppText style={styles.rankTotal}>of {userRank.total}</AppText>
                    </View>
                  </View>
                  <View style={styles.rankStats}>
                    <View style={styles.rankStat}>
                      <AppText style={styles.rankStatValue}>{userRank.xp.toLocaleString()}</AppText>
                      <AppText style={styles.rankStatLabel}>{t('gamification.totalXp')}</AppText>
                    </View>
                    <View style={styles.rankStat}>
                      <AppText style={styles.rankStatValue}>Lv.{userRank.level}</AppText>
                      <AppText style={styles.rankStatLabel}>{t('gamification.level')}</AppText>
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
                  <AppText style={styles.emptyText}>{t('gamification.leaderboardEmpty')}</AppText>
                </GlassCard>
              )}
            </View>

            {leaderboard && leaderboard.total > currentPage * PAGE_SIZE && (
              <Pressable
                style={({ pressed }) => [styles.loadMore, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setCurrentPage((p) => p + 1)}
              >
                <AppText style={styles.loadMoreLabel}>{t('gamification.loadMore')}</AppText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * The period the board is showing, said in the reader's own language.
 *
 * The month used to come from a hardcoded `en-US`, so a donor reading the rest
 * of this screen in Uzbek saw "September 2026" above it.
 */
function rangeSubtitle(
  range: TimeRange,
  t: (key: string) => string,
  formatMonth: (value: Date | string | number, width?: 'long' | 'short') => string,
): string {
  const now = new Date();
  // formatMonth already carries the year, so "September 2026" comes back
  // spelled and ordered for the active locale rather than assembled here.
  if (range === 'THIS_MONTH') return formatMonth(now);
  if (range === 'THIS_YEAR') return String(now.getFullYear());
  return t('gamification.topDonorsAllTime');
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
  const { t } = useTranslation();
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
            {isMe && <Badge variant="primary">{t('sos.you')}</Badge>}
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
      gap: layout.cardGap,
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
