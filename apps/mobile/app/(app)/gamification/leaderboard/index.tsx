import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useLeaderboard, useUserRank } from '../../../../src/hooks/useGamification';
import { Screen, GlassCard } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { LeaderboardItem } from '../../../../src/components/gamification/LeaderboardItem';
import { colors, spacing, radius } from '../../../../src/theme';

type TimeRange = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH';

const timeRangeOptions: { label: string; value: TimeRange }[] = [
  { label: 'All Time', value: 'ALL_TIME' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'This Month', value: 'THIS_MONTH' },
];

export default function LeaderboardScreen() {
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
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="display">
            Leaderboard
          </AppText>
          <AppText variant="body" muted>
            Top donors in the community
          </AppText>
        </View>

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
          {leaderboard?.entries.map((entry) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
