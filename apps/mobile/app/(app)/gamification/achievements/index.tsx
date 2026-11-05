import { router } from 'expo-router';
import { Award } from 'lucide-react-native';
import {
  EmptyState,
  ErrorState,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
} from '../../../../src/design';
import { AchievementRow } from '../../../../src/components/gamification/AchievementRow';
import { useAchievements } from '../../../../src/hooks/useGamification';
import { useTranslation } from '../../../../src/i18n';

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { data: achievements, isPending, isError, refetch, isRefetching } = useAchievements();

  const unlocked = achievements?.unlocked ?? [];
  const inProgress = achievements?.inProgress ?? [];
  const locked = achievements?.locked ?? [];
  const total = unlocked.length + inProgress.length + locked.length;

  const header = (
    <ScreenHeader
      title={t('gamification.achievements')}
      size="large"
      // `${n} of ${m} unlocked` was an English literal here.
      eyebrow={t('gamification.unlockedOf', { unlocked: unlocked.length, total })}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending && !achievements) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="md">
          <Skeleton height={120} />
          <Skeleton height={120} />
        </Stack>
      </ScrollScreen>
    );
  }

  // A network failure used to render as an empty screen, which reads as
  // "you have none" -- a different and wrong answer.
  if (isError && !achievements) {
    return (
      <ScrollScreen header={header}>
        <ErrorState
          title={t('common.errorTitle')}
          description={t('common.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </ScrollScreen>
    );
  }

  if (total === 0) {
    return (
      <ScrollScreen header={header}>
        <EmptyState
          title={t('gamification.noAchievements')}
          icon={({ size, color }) => <Award size={size} color={color} />}
        />
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen header={header} refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Stack gap="xl">
        {unlocked.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={`${t('gamification.unlocked')} · ${unlocked.length}`} />
            {unlocked.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))}
          </Stack>
        ) : null}

        {inProgress.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={`${t('gamification.inProgress')} · ${inProgress.length}`} />
            {inProgress.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))}
          </Stack>
        ) : null}

        {locked.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={`${t('gamification.locked')} · ${locked.length}`} />
            {locked.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </ScrollScreen>
  );
}
