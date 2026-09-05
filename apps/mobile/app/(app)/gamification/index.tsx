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
import { Card, GlassCard, GradientCard, ScreenHeader } from '../../../src/components';
import { AppText } from '../../../src/components/AppText';
import { XpProgressBar } from '../../../src/components/gamification/XpProgressBar';
import { AchievementCard } from '../../../src/components/gamification/AchievementCard';
import { BadgeDisplay } from '../../../src/components/gamification/BadgeDisplay';
import { Award, Star, Trophy, Zap } from 'lucide-react-native';
import { spacing, useTheme, ThemeColors } from '../../../src/theme';

export default function GamificationScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useGamificationProfile();
  const { data: levelProgress, isLoading: progressLoading, refetch: refetchProgress } = useLevelProgress();
  const { data: achievements, refetch: refetchAchievements } = useAchievements();
  const { data: badges, refetch: refetchBadges } = useBadges();

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
        <ScreenHeader title="Achievements" subtitle="Your progress & rewards" />
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title="Achievements"
        subtitle="Your progress & rewards"
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >

        <GradientCard
          colors={['#E5B86D', '#D4A043']}
          style={styles.profileCard}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <AppText style={styles.levelEyebrow}>LEVEL</AppText>
              <AppText style={styles.levelNumber}>{profile?.level || 1}</AppText>
              <AppText style={styles.levelName}>
                {levelProgress?.currentLevelName || 'New Donor'}
              </AppText>
            </View>
            <View style={styles.xpColumn}>
              <Zap size={32} color="rgba(255,255,255,0.8)" />
              <AppText style={styles.xpValue}>{profile?.totalXp || 0}</AppText>
              <AppText style={styles.xpLabel}>XP points</AppText>
            </View>
          </View>

          <View style={styles.progressLabelRow}>
            <AppText style={styles.progressLabel}>
              Progress to {levelProgress?.nextLevelName ?? 'next level'}
            </AppText>
            <AppText style={styles.progressValue}>
              {profile?.totalXp || 0} / {(profile?.totalXp || 0) + (profile?.xpToNextLevel || 0)}
            </AppText>
          </View>
          <XpProgressBar
            currentXp={profile?.totalXp || 0}
            xpToNextLevel={profile?.xpToNextLevel || 0}
            progress={profile?.progress || 0}
            size="medium"
            onGradient
          />
        </GradientCard>

        {/* The reference lifts these three out of the hero into their own
            standard-tier cards, so the hero carries only level and XP. */}
        <View style={styles.quickStatsRow}>
          <Card style={styles.quickStat}>
            <Trophy size={20} color={colors.warning} />
            <AppText style={styles.quickStatValue}>{profile?.donationCount || 0}</AppText>
            <AppText muted style={styles.quickStatLabel}>
              Donations
            </AppText>
          </Card>
          <Card style={styles.quickStat}>
            <Star size={20} color={colors.ai} />
            <AppText style={styles.quickStatValue}>
              {profile?.rank ? `#${profile.rank}` : '—'}
            </AppText>
            <AppText muted style={styles.quickStatLabel}>
              Rank
            </AppText>
          </Card>
          <Card style={styles.quickStat}>
            <Award size={20} color={colors.success} />
            <AppText style={styles.quickStatValue}>{profile?.reputationScore || 0}</AppText>
            <AppText muted style={styles.quickStatLabel}>
              Reputation
            </AppText>
          </Card>
        </View>

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
          onPress={() => router.push('/gamification/leaderboard' as any)}
          activeOpacity={0.8}
        >
          <GlassCard tier="elevated" style={styles.leaderboardButton}>
            <AppText variant="button">
              View Leaderboard
            </AppText>
          </GlassCard>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </Screen>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: spacing.lg,
    },
    // Vivid, saturated brand gradient rather than a theme surface, so its
    // text is fixed white/near-white in both themes instead of `colors.text`.
    onGradientText: {
      color: '#FFFFFF',
    },
    onGradientMuted: {
      color: 'rgba(255,255,255,0.75)',
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    profileInfo: {
      flex: 1,
    },
    levelEyebrow: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.1,
      color: 'rgba(255,255,255,0.75)',
    },
    levelNumber: {
      fontSize: 52,
      fontWeight: '800',
      lineHeight: 52,
      letterSpacing: -2.08,
      color: '#FFFFFF',
    },
    levelName: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.7)',
    },
    xpColumn: {
      alignItems: 'flex-end',
    },
    xpValue: {
      fontSize: 22,
      fontWeight: '700',
      color: '#FFFFFF',
      marginTop: 4,
    },
    xpLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.65)',
    },
    progressValue: {
      fontSize: 11,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.9)',
    },
    quickStatsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    quickStat: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
    },
    quickStatValue: {
      fontSize: 22,
      fontWeight: '700',
      marginTop: 6,
    },
    quickStatLabel: {
      fontSize: 11,
      textAlign: 'center',
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
      alignItems: 'center',
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
