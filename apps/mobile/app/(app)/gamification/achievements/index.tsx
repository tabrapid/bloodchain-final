import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useAchievements } from '../../../../src/hooks/useGamification';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { AchievementCard } from '../../../../src/components/gamification/AchievementCard';
import { spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { data: achievements, isLoading, refetch } = useAchievements();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, []);

  if (isLoading && !achievements) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  const unlockedCount = achievements?.unlocked.length || 0;
  const inProgressCount = achievements?.inProgress.length || 0;
  const lockedCount = achievements?.locked.length || 0;

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
            Achievements
          </AppText>
          <AppText variant="body" muted>
            {unlockedCount} of {unlockedCount + inProgressCount + lockedCount} unlocked
          </AppText>
        </View>

        {achievements && achievements.unlocked.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.success }}>
                Unlocked
              </AppText>
              <View style={styles.countBadge}>
                <AppText variant="caption" style={{ color: colors.onMuted.success }}>
                  {unlockedCount}
                </AppText>
              </View>
            </View>

            {achievements.unlocked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={false} />
            ))}
          </View>
        )}

        {achievements && achievements.inProgress.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.warning }}>
                In Progress
              </AppText>
              <View style={[styles.countBadge, styles.inProgressBadge]}>
                <AppText variant="caption" style={{ color: colors.onMuted.warning }}>
                  {inProgressCount}
                </AppText>
              </View>
            </View>

            {achievements.inProgress.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={true} />
            ))}
          </View>
        )}

        {achievements && achievements.locked.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" muted>
                Locked
              </AppText>
              <View style={[styles.countBadge, styles.lockedBadge]}>
                <AppText variant="caption" muted>
                  {lockedCount}
                </AppText>
              </View>
            </View>

            {achievements.locked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={false} />
            ))}
          </View>
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
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    countBadge: {
      backgroundColor: colors.successMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginLeft: spacing.sm,
    },
    inProgressBadge: {
      backgroundColor: colors.warningMuted,
    },
    lockedBadge: {
      backgroundColor: colors.surfaceHighlight,
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
