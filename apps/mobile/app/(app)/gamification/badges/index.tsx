import { router } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  space,
} from '../../../../src/design';
import { BadgeTile } from '../../../../src/components/gamification/BadgeTile';
import { useBadges } from '../../../../src/hooks/useGamification';
import { useTranslation } from '../../../../src/i18n';
import { Trophy } from 'lucide-react-native';

export default function BadgesScreen() {
  const { t } = useTranslation();
  const { data: badges, isPending, isError, refetch, isRefetching } = useBadges();

  const earned = badges?.filter((b) => b.earnedAt) ?? [];
  const unearned = badges?.filter((b) => !b.earnedAt) ?? [];

  const header = (
    <ScreenHeader
      title={t('gamification.badges')}
      // `${n} of ${m} earned` was an English literal here.
      eyebrow={t('gamification.earnedOf', { earned: earned.length, total: badges?.length ?? 0 })}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending && !badges) {
    return (
      <ScrollScreen header={header}>
        <Skeleton height={160} />
      </ScrollScreen>
    );
  }

  // A network failure used to render as an empty screen, which reads as
  // "you have none" -- a different and wrong answer.
  if (isError && !badges) {
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

  if ((badges?.length ?? 0) === 0) {
    return (
      <ScrollScreen header={header}>
        <EmptyState
          title={t('gamification.noBadges')}
          icon={({ size, color }) => <Trophy size={size} color={color} />}
        />
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen header={header} refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Stack gap="xl">
        {earned.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={`${t('gamification.earned')} · ${earned.length}`} />
            <Surface>
              <Row gap="md" align="flex-start" style={{ flexWrap: 'wrap', rowGap: space.lg }}>
                {earned.map((badge) => (
                  <BadgeTile key={badge.id} badge={badge} width="28%" />
                ))}
              </Row>
            </Surface>
          </Stack>
        ) : null}

        {unearned.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={`${t('gamification.notYetEarned')} · ${unearned.length}`} />
            <Surface>
              <Row gap="md" align="flex-start" style={{ flexWrap: 'wrap', rowGap: space.lg }}>
                {unearned.map((badge) => (
                  <BadgeTile key={badge.id} badge={badge} width="28%" />
                ))}
              </Row>
            </Surface>
          </Stack>
        ) : null}
      </Stack>
    </ScrollScreen>
  );
}
