import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, ChevronRight, Star, Trophy } from 'lucide-react-native';
import {
  useGamificationProfile,
  useLevelProgress,
  useAchievements,
  useBadges,
} from '../../../src/hooks/useGamification';
import {
  LinkButton,
  Progress,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Stat,
  StatRow,
  Surface,
  Text,
  ValueText,
  iconSize,
  space,
  useDesign,
  ErrorState,
} from '../../../src/design';
import { BadgeTile } from '../../../src/components/gamification/BadgeTile';
import { percentAsFraction } from '../../../src/utils/progress';
import { AchievementRow } from '../../../src/components/gamification/AchievementRow';
import type { Badge } from '../../../src/api/gamification';
import { useTranslation } from '../../../src/i18n';

/**
 * Recognition, rebuilt for V2.
 *
 * The product rule is that donating blood must not feel like a game, and this
 * is the screen that broke it hardest: a gold gradient card with a 44pt level
 * number, a lightning bolt and a white progress bar, in the visual language of
 * a mobile game's season pass.
 *
 * Every number survives -- level, XP, rank, badges earned, achievements in
 * progress and unlocked -- on ordinary surfaces. Recognition is stated; it is
 * not performed at the donor.
 */
export default function GamificationScreen() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const router = useRouter();

  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
    refetch: refetchProfile,
  } = useGamificationProfile();
  const { data: levelProgress, isPending: progressPending, refetch: refetchProgress } = useLevelProgress();
  const { data: achievements, refetch: refetchAchievements, isRefetching } = useAchievements();
  const { data: badges, refetch: refetchBadges } = useBadges();

  const earnedBadges = badges?.filter((badge) => badge.earnedAt).length ?? 0;
  const inProgress = achievements?.inProgress ?? [];
  const unlocked = achievements?.unlocked ?? [];

  // Earned first, then the ones still to come: a collection you can see the
  // shape of, rather than a list of what you happen to have.
  const badgeGrid: Badge[] = useMemo(() => {
    if (!badges) return [];
    return [...badges].sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt)).slice(0, 12);
  }, [badges]);

  const isPending = profilePending || progressPending;

  const header = (
    <ScreenHeader
      title={t('gamification.achievements')}
      eyebrow={t('gamification.subtitle')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  // A failed request used to fall through to the zeros: a donor with forty
  // donations was shown Level 1, 0 XP, rank "—" and "No badges yet -- your
  // first donation earns one", which is not a loading state, it is a lie about
  // their record.
  if (profileError && !profile) {
    return (
      <ScrollScreen header={header}>
        <ErrorState
          title={t('common.errorTitle')}
          description={t('common.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void refetchProfile();
            void refetchProgress();
          }}
        />
      </ScrollScreen>
    );
  }

  if (isPending && !profile) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={140} />
          <Skeleton height={96} />
          <Skeleton height={96} />
        </Stack>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      header={header}
      refreshing={isRefetching}
      onRefresh={() => {
        void refetchProfile();
        void refetchProgress();
        void refetchAchievements();
        void refetchBadges();
      }}
    >
      <Stack gap="xl">
        {/* ------------------------------------------------ where you are */}
        <Surface>
          <Stack gap="lg">
            <Row gap="lg" align="flex-start">
              <View style={{ gap: 2 }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('gamification.level')}
                </Text>
                <ValueText variant="display">{profile?.level ?? 1}</ValueText>
                <Text variant="caption" tone="secondary">
                  {levelProgress?.currentLevelName ?? t('gamification.newDonor')}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('gamification.xpPoints')}
                </Text>
                <ValueText variant="h1" style={{ color: colors.insight.text }}>
                  {profile?.totalXp ?? 0}
                </ValueText>
              </View>
            </Row>

            <Progress
              label={t('gamification.progressToLevel', {
                level: levelProgress?.nextLevelName ?? t('gamification.nextLevel'),
              })}
              // The label already names the level being worked towards; the
              // caption used to name it again, in the same 329pt row, in a
              // server-supplied English string that is longer in Russian than
              // the row is wide. The number is enough here.
              caption={t('gamification.xpValue', { xp: profile?.xpToNextLevel ?? 0 })}
              value={percentAsFraction(profile?.progress)}
              tone="insight"
            />
          </Stack>
        </Surface>

        <StatRow>
          <Stat
            label={t('gamification.badgesEarned')}
            value={String(earnedBadges)}
            icon={({ size, color }) => <Trophy size={size} color={color} />}
            tone="warning"
          />
          <Stat
            label={t('gamification.rankOverall')}
            value={profile?.rank ? `#${profile.rank}` : '—'}
            icon={({ size, color }) => <Star size={size} color={color} />}
            tone="insight"
          />
          <Stat
            label={t('gamification.inProgress')}
            value={String(inProgress.length)}
            icon={({ size, color }) => <Award size={size} color={color} />}
            tone="success"
          />
        </StatRow>

        {/* ------------------------------------------------------ badges */}
        <Stack gap="md">
          <SectionHeader
            title={t('gamification.badges')}
            action={
              <LinkButton
                label={t('actions.viewAll')}
                onPress={() => router.push('/gamification/badges')}
              />
            }
          />
          {badgeGrid.length > 0 ? (
            <Surface>
              <Row gap="md" align="flex-start" style={{ flexWrap: 'wrap', rowGap: space.lg }}>
                {badgeGrid.map((badge) => (
                  <BadgeTile key={badge.id} badge={badge} width="28%" />
                ))}
              </Row>
            </Surface>
          ) : (
            <Surface>
              <Text variant="body" tone="secondary">
                {t('gamification.noBadges')}
              </Text>
            </Surface>
          )}
        </Stack>

        {/* -------------------------------------------------- in progress */}
        <Stack gap="md">
          <SectionHeader title={t('gamification.activeChallenges')} />
          {inProgress.length > 0 ? (
            inProgress.slice(0, 4).map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))
          ) : (
            <Surface>
              <Text variant="body" tone="secondary">
                {t('gamification.nothingInProgress')}
              </Text>
            </Surface>
          )}
        </Stack>

        {/* ----------------------------------------------------- unlocked */}
        <Stack gap="md">
          <SectionHeader
            title={t('gamification.unlocked')}
            action={
              <LinkButton
                label={t('actions.viewAll')}
                onPress={() => router.push('/gamification/achievements')}
              />
            }
          />
          {unlocked.length > 0 ? (
            unlocked.slice(0, 3).map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))
          ) : (
            <Surface>
              <Text variant="body" tone="secondary">
                {t('gamification.noAchievements')}
              </Text>
            </Surface>
          )}
        </Stack>

        <Surface
          onPress={() => router.push('/gamification/leaderboard')}
          accessibilityLabel={`${t('gamification.leaderboard')}. ${
            profile?.rank
              ? t('gamification.yourRankAmong', { rank: profile.rank })
              : t('gamification.seeWhereYouStand')
          }`}
        >
          <Row gap="md">
            <Trophy size={iconSize.lg} color={colors.textSecondary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{t('gamification.leaderboard')}</Text>
              <Text variant="caption" tone="secondary">
                {profile?.rank
                  ? t('gamification.yourRankAmong', { rank: profile.rank })
                  : t('gamification.seeWhereYouStand')}
              </Text>
            </View>
            <ChevronRight size={iconSize.md} color={colors.textTertiary} />
          </Row>
        </Surface>
      </Stack>
    </ScrollScreen>
  );
}
