import { useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Clock, Trophy } from 'lucide-react-native';
import { getActiveChallenges, joinChallenge, type Challenge } from '../../../src/api/challenges';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Progress,
  Row,
  Screen,
  ScreenHeader,
  SkeletonRow,
  Stack,
  Surface,
  Text,
  iconSize,
  layout,
  space,
  useDesign,
} from '../../../src/design';
import { useTranslation } from '../../../src/i18n';

export default function ChallengesScreen() {
  const { t } = useTranslation();
  const [joinError, setJoinError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: challenges, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const joinMutation = useMutation({
    mutationFn: joinChallenge,
    onSuccess: () => {
      setJoinError(null);
      void queryClient.invalidateQueries({ queryKey: ['active-challenges'] });
      void queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
    },
    onError: (err: Error) => {
      setJoinError(err.message || t('challenges.joinFailed'));
    },
  });

  const header = (
    <ScreenHeader
      title={t('challenges.title')}
      eyebrow={t('challenges.subtitle')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending) {
    return (
      <Screen>
        {header}
        <Surface>
          <SkeletonRow />
          <SkeletonRow />
        </Surface>
      </Screen>
    );
  }

  // A network failure used to render as an empty list, which reads as
  // "there are none" -- a different and wrong answer.
  if (isError) {
    return (
      <Screen>
        {header}
        <ErrorState
          title={t('common.errorTitle')}
          description={t('common.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen gutter={false}>
      {header}
      <FlatList
        style={{ flex: 1 }}
        data={challenges ?? []}
        keyExtractor={(challenge) => challenge.id}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: layout.tabBarClearance,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        renderItem={({ item: challenge }) => (
          <ChallengeCard
            challenge={challenge}
            onJoin={() => joinMutation.mutate(challenge.id)}
            isJoining={joinMutation.isPending}
          />
        )}
        ListHeaderComponent={
          joinError ? (
            <Banner tone="critical" title={joinError} style={{ marginBottom: space.md }} />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title={t('challenges.empty')}
            description={t('challenges.emptyHint')}
            icon={({ size, color }) => <Trophy size={size} color={color} />}
          />
        }
      />
    </Screen>
  );
}

function ChallengeCard({
  challenge,
  onJoin,
  isJoining,
}: {
  challenge: Challenge;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();
  const current = challenge.userProgress || 0;
  const progress = challenge.goal > 0 ? current / challenge.goal : 0;
  const hasJoined = challenge.userProgress !== undefined;

  return (
    <Surface>
      <Stack gap="md">
        <Row gap="md" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            {/* The type used to render as its enum -- "DONATION_MILESTONE" --
                in a rose badge beside the title. */}
            <Badge label={t(`challenges.types.${challenge.type}`)} tone="insight" />
            <Text variant="h3">{challenge.title}</Text>
          </Stack>
        </Row>

        <Text variant="body" tone="secondary" numberOfLines={3}>
          {challenge.description}
        </Text>

        {challenge.endDate ? (
          <Row gap="sm">
            <Clock size={iconSize.sm} color={colors.textTertiary} />
            <Text variant="caption" tone="secondary">
              {t('challenges.endsOn', { date: formatDate(challenge.endDate, 'medium') })}
            </Text>
          </Row>
        ) : null}

        <Progress
          label={t('table.progress')}
          caption={`${current} / ${challenge.goal}`}
          value={progress}
          tone="warning"
        />

        <Row gap="lg" style={{ flexWrap: 'wrap' }}>
          {challenge.xpReward > 0 ? (
            <Row gap="xs">
              <Trophy size={iconSize.sm} color={colors.warning.base} />
              <Text variant="caption" tone="secondary">
                {`+${challenge.xpReward} ${t('profile.xp')}`}
              </Text>
            </Row>
          ) : null}
          {challenge.badge ? (
            <Row gap="xs">
              <Award size={iconSize.sm} color={colors.warning.base} />
              <Text variant="caption" tone="secondary">
                {challenge.badge.name}
              </Text>
            </Row>
          ) : null}
        </Row>

        {!hasJoined ? (
          <Button label={t('challenges.joinChallenge')} loading={isJoining} onPress={onJoin} />
        ) : progress >= 1 ? (
          <Badge label={t('challenges.completed')} tone="success" />
        ) : null}
      </Stack>
    </Surface>
  );
}
