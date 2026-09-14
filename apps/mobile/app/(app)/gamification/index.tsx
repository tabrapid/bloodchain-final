import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, Star, Trophy, Zap } from 'lucide-react-native';
import {
  useGamificationProfile,
  useLevelProgress,
  useAchievements,
  useBadges,
} from '../../../src/hooks/useGamification';
import {
  Screen,
  GlassCard,
  GradientCard,
  Badge as Chip,
  ProgressBar,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
} from '../../../src/components';
import { AppText } from '../../../src/components/AppText';
import { XpProgressBar } from '../../../src/components/gamification/XpProgressBar';
import { BadgeDisplay } from '../../../src/components/gamification/BadgeDisplay';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../src/theme';
import type { Achievement, Badge } from '../../../src/api/gamification';
import { useTranslation } from '../../../src/i18n';

export default function GamificationScreen() {
  const { t } = useTranslation();
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
  }, [refetchProfile, refetchProgress, refetchAchievements, refetchBadges]);

  const isLoading = profileLoading || progressLoading;

  const earnedBadges = badges?.filter((badge) => badge.earnedAt).length ?? 0;
  const inProgress = achievements?.inProgress ?? [];
  const unlocked = achievements?.unlocked ?? [];
  // The reference shows twelve badge tiles: earned first, then the ones still
  // to come at a third of the opacity, which is what makes the grid read as a
  // collection rather than a list of what you happen to have.
  const badgeGrid: Badge[] = React.useMemo(() => {
    if (!badges) return [];
    return [...badges].sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt)).slice(0, 12);
  }, [badges]);

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('gamification.achievements')} subtitle={t('gamification.subtitle')} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading && !profile ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <GradientCard colors={['#E5B86D', '#D4A043']} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroLevel}>
                  <AppText style={styles.levelEyebrow}>{t('gamification.level')}</AppText>
                  <AppText style={styles.levelNumber}>{profile?.level ?? 1}</AppText>
                  <AppText style={styles.levelName}>
                    {levelProgress?.currentLevelName ?? t('gamification.newDonor')}
                  </AppText>
                </View>
                <View style={styles.heroXp}>
                  <Zap size={32} color="rgba(255,255,255,0.8)" />
                  <AppText style={styles.xpValue}>{profile?.totalXp ?? 0}</AppText>
                  <AppText style={styles.xpLabel}>{t('gamification.xpPoints')}</AppText>
                </View>
              </View>

              <View style={styles.progressLabelRow}>
                <AppText style={styles.progressLabel}>
                  {t('gamification.progressToLevel', {
                    level: levelProgress?.nextLevelName ?? t('gamification.nextLevel'),
                  })}
                </AppText>
                <AppText style={styles.progressValue}>
                  {profile?.totalXp ?? 0} / {(profile?.totalXp ?? 0) + (profile?.xpToNextLevel ?? 0)}
                </AppText>
              </View>
              <XpProgressBar
                currentXp={profile?.totalXp ?? 0}
                xpToNextLevel={profile?.xpToNextLevel ?? 0}
                progress={profile?.progress ?? 0}
                size="medium"
                onGradient
              />
            </GradientCard>

            <View style={styles.statsRow}>
              <StatTile
                icon={<Trophy size={20} color={colors.onMuted.warning} />}
                value={String(earnedBadges)}
                label={t('gamification.badgesEarned')}
              />
              <StatTile
                icon={<Star size={20} color={colors.onMuted.ai} />}
                value={profile?.rank ? `#${profile.rank}` : '—'}
                label={t('gamification.rankOverall')}
              />
              <StatTile
                icon={<Award size={20} color={colors.onMuted.success} />}
                value={String(inProgress.length)}
                label={t('gamification.inProgress')}
              />
            </View>

            <SectionHeader action={{ label: t('actions.viewAll'), onPress: () => router.push('/gamification/badges') }}>
              {t('gamification.badges')}
            </SectionHeader>
            {badgeGrid.length > 0 ? (
              <View style={styles.badgeGrid}>
                {badgeGrid.map((badge) => (
                  <View key={badge.id} style={styles.badgeCell}>
                    <GlassCard style={[styles.badgeTile, !badge.earnedAt && styles.badgeTileLocked]}>
                      <BadgeDisplay badge={badge} size="small" />
                    </GlassCard>
                  </View>
                ))}
              </View>
            ) : (
              <GlassCard style={styles.emptyCard}>
                <AppText style={styles.emptyText}>
                  {t('gamification.noBadges')}
                </AppText>
              </GlassCard>
            )}

            <SectionHeader>{t('gamification.activeChallenges')}</SectionHeader>
            {inProgress.length > 0 ? (
              inProgress
                .slice(0, 4)
                .map((achievement) => (
                  <ChallengeCard key={achievement.id} achievement={achievement} />
                ))
            ) : (
              <GlassCard style={styles.emptyCard}>
                <AppText style={styles.emptyText}>
                  {t('gamification.nothingInProgress')}
                </AppText>
              </GlassCard>
            )}

            <SectionHeader
              action={{ label: t('actions.viewAll'), onPress: () => router.push('/gamification/achievements') }}
            >
              {t('gamification.unlocked')}
            </SectionHeader>
            {unlocked.length > 0 ? (
              unlocked.slice(0, 3).map((achievement) => (
                <ChallengeCard key={achievement.id} achievement={achievement} />
              ))
            ) : (
              <GlassCard style={styles.emptyCard}>
                <AppText style={styles.emptyText}>
                  {t('gamification.noAchievements')}
                </AppText>
              </GlassCard>
            )}

            <Pressable
              onPress={() => router.push('/gamification/leaderboard')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.leaderboardWrap, { opacity: pressed ? 0.7 : 1 }]}
            >
              <GlassCard tier="elevated">
                <View style={styles.leaderboardRow}>
                  <View style={styles.leaderboardIcon}>
                    <Trophy size={20} color={colors.onMuted.ai} />
                  </View>
                  <View style={styles.leaderboardBody}>
                    <AppText style={styles.leaderboardTitle}>{t('gamification.leaderboard')}</AppText>
                    <AppText style={styles.leaderboardMeta}>
                      {profile?.rank
                        ? t('gamification.yourRankAmong', { rank: profile.rank })
                        : t('gamification.seeWhereYouStand')}
                    </AppText>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <GlassCard style={styles.statTile}>
      {icon}
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </GlassCard>
  );
}

/**
 * The reference's challenge card: name and one line of description on the
 * left, the XP reward as a badge on the right, then a progress bar with the
 * percentage under its right edge. An achievement is this app's challenge --
 * same shape, same numbers -- so both the in-progress and unlocked lists use
 * it rather than two different cards.
 */
function ChallengeCard({ achievement }: { achievement: Achievement }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const percent =
    achievement.target > 0
      ? Math.min(100, Math.round((achievement.progress / achievement.target) * 100))
      : achievement.status === 'UNLOCKED'
        ? 100
        : 0;
  const complete = achievement.status === 'UNLOCKED' || percent === 100;

  return (
    <GlassCard style={styles.challengeCard}>
      <View style={styles.challengeHead}>
        <View style={styles.challengeText}>
          <AppText style={styles.challengeName}>{achievement.name}</AppText>
          <AppText style={styles.challengeDesc}>{achievement.description}</AppText>
        </View>
        <Chip variant={complete ? 'success' : 'default'}>{achievement.xpReward} XP</Chip>
      </View>
      <ProgressBar
        progress={percent}
        color={complete ? colors.success : colors.primary}
      />
      <AppText style={styles.challengePercent}>{percent}%</AppText>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: layout.cardGap,
      paddingBottom: spacing.xl,
    },

    hero: {},
    heroTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    heroLevel: {
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
    heroXp: {
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

    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statTile: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginTop: 6,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 1,
    },

    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -5,
    },
    badgeCell: {
      width: '25%',
      paddingHorizontal: 5,
      paddingBottom: 10,
    },
    badgeTile: {
      padding: 10,
      alignItems: 'center',
    },
    badgeTileLocked: {
      opacity: 0.35,
    },

    challengeCard: {},
    challengeHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 10,
    },
    challengeText: {
      flex: 1,
    },
    challengeName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    challengeDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    challengePercent: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 6,
    },

    leaderboardWrap: {
      marginTop: spacing.sm,
    },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    leaderboardIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.aiMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderboardBody: {
      flex: 1,
    },
    leaderboardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    leaderboardMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },

    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
