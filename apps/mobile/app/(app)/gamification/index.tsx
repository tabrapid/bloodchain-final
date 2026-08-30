import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGamificationProfile, useLevelProgress, useAchievements, useBadges } from '../../../src/hooks/useGamification';
import { Screen } from '../../../src/components/Screen';
import { GlassCard, GradientCard } from '../../../src/components';
import { AppText } from '../../../src/components/AppText';
import { XpProgressBar } from '../../../src/components/gamification/XpProgressBar';
import { AchievementCard } from '../../../src/components/gamification/AchievementCard';
import { BadgeDisplay } from '../../../src/components/gamification/BadgeDisplay';
import { spacing, radius, useTheme, ThemeColors } from '../../../src/theme';

export default function GamificationScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useGamificationProfile();
  const { data: levelProgress, isLoading: progressLoading, refetch: refetchProgress } = useLevelProgress();
  const { data: achievements, isLoading: achievementsLoading, refetch: refetchAchievements } = useAchievements();
  const { data: badges, isLoading: badgesLoading, refetch: refetchBadges } = useBadges();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchProfile(),
      refetchProgress(),
      refetchAchievements(),
      refetchBadges(),
    ]);
    setRefreshing(false);
  }, []);

  const isLoading = profileLoading || progressLoading;

  const recentAchievements = achievements?.unlocked.slice(0, 3) || [];
  const inProgressAchievements = achievements?.inProgress.slice(0, 3) || [];

  if (isLoading && !profile) {
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
            Gamification
          </AppText>
          <AppText variant="body" muted>
            Track your progress and achievements
          </AppText>
        </View>

        <GradientCard
          colors={[colors.primary, colors.primaryMuted]}
          style={styles.profileCard}
        >
          <View style={styles.profileHeader}>
            <View style={styles.levelBadge}>
              <AppText variant="title" >
                {profile?.level || 1}
              </AppText>
              <AppText variant="caption" muted>
                LEVEL
              </AppText>
            </View>
            <View style={styles.profileInfo}>
              <AppText variant="heading" >
                {levelProgress?.currentLevelName || 'New Donor'}
              </AppText>
              <View style={styles.xpRow}>
                <AppText variant="numeric" >
                  {profile?.totalXp || 0}
                </AppText>
                <AppText variant="body" muted style={styles.xpLabel}>
                  {' '}XP
                </AppText>
              </View>
            </View>
          </View>

          <XpProgressBar
            currentXp={profile?.totalXp || 0}
            xpToNextLevel={profile?.xpToNextLevel || 0}
            progress={profile?.progress || 0}
            size="medium"
          />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <AppText variant="heading" >
                {profile?.donationCount || 0}
              </AppText>
              <AppText variant="caption" muted>
                Donations
              </AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText variant="heading" >
                {profile?.rank || '-'}
              </AppText>
              <AppText variant="caption" muted>
                Rank
              </AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText variant="heading" >
                {profile?.reputationScore || 0}
              </AppText>
              <AppText variant="caption" muted>
                Reputation
              </AppText>
            </View>
          </View>
        </GradientCard>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="heading" >
              Your Badges
            </AppText>
            <TouchableOpacity onPress={() => router.push('/gamification/badges' as any)}>
              <AppText variant="body" style={{ color: colors.primary }}>
                View All
              </AppText>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.badgesScroll}
          >
            {badges && badges.length > 0 ? (
              badges.slice(0, 6).map((badge) => (
                <BadgeDisplay key={badge.id} badge={badge} size="medium" />
              ))
            ) : (
              <AppText variant="body" muted>
                No badges yet. Keep contributing!
              </AppText>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="heading" >
              Recent Achievements
            </AppText>
            <TouchableOpacity onPress={() => router.push('/gamification/achievements' as any)}>
              <AppText variant="body" style={{ color: colors.primary }}>
                View All
              </AppText>
            </TouchableOpacity>
          </View>

          {recentAchievements.length > 0 ? (
            recentAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))
          ) : (
            <GlassCard style={styles.emptyCard}>
              <AppText variant="body" muted style={styles.emptyText}>
                Complete donations to unlock achievements
              </AppText>
            </GlassCard>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="heading" >
              In Progress
            </AppText>
          </View>

          {inProgressAchievements.length > 0 ? (
            inProgressAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))
          ) : (
            <GlassCard style={styles.emptyCard}>
              <AppText variant="body" muted style={styles.emptyText}>
                Keep going! You're making great progress.
              </AppText>
            </GlassCard>
          )}
        </View>

        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={() => router.push('/gamification/leaderboard' as any)}
        >
          <AppText variant="button">
            View Leaderboard
          </AppText>
        </TouchableOpacity>

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
    profileCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: spacing.lg,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    levelBadge: {
      width: 64,
      height: 64,
      borderRadius: radius.md,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.lg,
    },
    profileInfo: {
      flex: 1,
    },
    xpRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    xpLabel: {
      marginLeft: 4,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    badgesScroll: {
      marginHorizontal: -spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    emptyCard: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      textAlign: 'center',
    },
    leaderboardButton: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      backgroundColor: colors.surfaceSolid,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
