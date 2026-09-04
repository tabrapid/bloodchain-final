import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { useLeaderboard, useUserRank } from '../../../../src/hooks/useGamification';
import { Screen, GlassCard, Avatar, ScreenHeader } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { LeaderboardItem } from '../../../../src/components/gamification/LeaderboardItem';
import { spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';
import type { LeaderboardEntry } from '../../../../src/api/gamification';

const PODIUM_COLORS = ['#E5B86D', '#8495A3', '#CD7F32'] as const;
const PODIUM_HEIGHTS = [70, 50, 40] as const;
const PODIUM_ORDER = [1, 0, 2] as const;

type TimeRange = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH';

const timeRangeOptions: { label: string; value: TimeRange }[] = [
  { label: 'All Time', value: 'ALL_TIME' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'This Month', value: 'THIS_MONTH' },
];

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('ALL_TIME');
  const [currentPage, setCurrentPage] = React.useState(1);

  const { data: leaderboard, isLoading, refetch } = useLeaderboard(timeRange, currentPage, 10);
  const { data: userRank, refetch: refetchRank } = useUserRank(timeRange);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchRank()]);
    setRefreshing(false);
  }, []);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    setCurrentPage(1);
  };

  if (isLoading && !leaderboard) {
    return (
      <Screen>
        <ScreenHeader title="Leaderboard" />
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title="Leaderboard"
        subtitle="Top donors in the community"
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.timeRangeContainer}>
          {timeRangeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.timeRangeButton,
                timeRange === option.value && styles.timeRangeButtonActive,
              ]}
              onPress={() => handleTimeRangeChange(option.value)}
            >
              <AppText
                variant="body"
                style={timeRange === option.value ? { color: colors.primary } : undefined}
              >
                {option.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {currentPage === 1 && leaderboard && leaderboard.entries.length >= 3 && (
          <View style={styles.podiumRow}>
            {PODIUM_ORDER.map((slot) => {
              const entry = leaderboard.entries[slot]!;
              const isFirst = slot === 0;
              return (
                <View key={entry.userId} style={styles.podiumColumn}>
                  <View style={isFirst ? styles.podiumAvatarWrap : undefined}>
                    <Avatar name={entry.displayName} size={isFirst ? 58 : 48} />
                    {isFirst && (
                      <View style={styles.podiumTrophy}>
                        <Trophy size={14} color={PODIUM_COLORS[0]} />
                      </View>
                    )}
                  </View>
                  <AppText
                    numberOfLines={1}
                    style={{ fontSize: 11, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center' }}
                  >
                    {entry.displayName.split(' ')[0]}
                  </AppText>
                  <View
                    style={[
                      styles.podiumBar,
                      { height: PODIUM_HEIGHTS[slot], backgroundColor: PODIUM_COLORS[slot] },
                    ]}
                  >
                    <AppText style={{ fontSize: isFirst ? 22 : 18, fontWeight: '800', color: '#FFFFFF' }}>
                      {slot + 1}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {userRank && (
          <GlassCard style={styles.yourRankCard}>
            <View style={styles.yourRankContent}>
              <View>
                <AppText variant="caption" muted>
                  YOUR RANK
                </AppText>
                <View style={styles.rankRow}>
                  <AppText variant="display" style={{ color: colors.primary }}>
                    #{userRank.rank}
                  </AppText>
                  <AppText variant="body" muted style={styles.totalUsers}>
                    of {userRank.total}
                  </AppText>
                </View>
              </View>
              <View style={styles.yourRankStats}>
                <View style={styles.yourRankStat}>
                  <AppText variant="heading">
                    {userRank.xp.toLocaleString()}
                  </AppText>
                  <AppText variant="caption" muted>
                    Total XP
                  </AppText>
                </View>
                <View style={styles.yourRankStat}>
                  <AppText variant="heading">
                    Lv.{userRank.level}
                  </AppText>
                  <AppText variant="caption" muted>
                    Level
                  </AppText>
                </View>
              </View>
            </View>
          </GlassCard>
        )}

        <View style={styles.leaderboardList}>
          {(currentPage === 1 && leaderboard && leaderboard.entries.length >= 3
            ? leaderboard.entries.slice(3)
            : leaderboard?.entries ?? []
          ).map((entry) => (
            <LeaderboardItem key={entry.userId} entry={entry} />
          ))}

          {leaderboard?.entries.length === 0 && (
            <GlassCard style={styles.emptyCard}>
              <AppText variant="body" muted style={styles.emptyText}>
                No leaderboard data available yet
              </AppText>
            </GlassCard>
          )}
        </View>

        {leaderboard && leaderboard.total > currentPage * 10 && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setCurrentPage((p) => p + 1)}
          >
            <AppText variant="button" style={{ color: colors.primary }}>
              Load More
            </AppText>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeRangeContainer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    timeRangeButtonActive: {
      borderBottomColor: colors.primary,
    },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    podiumColumn: {
      flex: 1,
      alignItems: 'center',
    },
    podiumAvatarWrap: {
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
    podiumBar: {
      width: '100%',
      borderTopLeftRadius: radius.sm,
      borderTopRightRadius: radius.sm,
      marginTop: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    yourRankCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    yourRankContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    totalUsers: {
      marginLeft: spacing.sm,
    },
    yourRankStats: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    yourRankStat: {
      alignItems: 'flex-end',
    },
    leaderboardList: {
      paddingHorizontal: spacing.lg,
    },
    emptyCard: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      textAlign: 'center',
    },
    loadMoreButton: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.md,
      alignItems: 'center',
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
