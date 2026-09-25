import { useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, BookOpen, CheckCircle, Clock, PlayCircle } from 'lucide-react-native';
import {
  getEducationalContent,
  startContent,
  completeContent,
  getMyEducationProgress,
  getMyEducationStats,
  type EducationalContent,
} from '../../../src/api/education';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  SkeletonRow,
  Stack,
  Stat,
  StatRow,
  Surface,
  Text,
  iconSize,
  layout,
  space,
  useDesign,
  useTabBarClearance,
} from '../../../src/design';
import { useTranslation } from '../../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

/** The three difficulties the content actually uses; anything else is shown as written. */
const KNOWN_DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

function difficultyLabel(value: string, t: TranslateFn): string {
  return KNOWN_DIFFICULTIES.includes(value)
    ? t(`education.difficulties.${value}`)
    : // Content-authored and not in the catalogue: shown as written rather
      // than shouted, and never guessed at.
      value.charAt(0) + value.slice(1).toLowerCase();
}

export default function EducationScreen() {
  const tabBarClearance = useTabBarClearance();
  const { t } = useTranslation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: content, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['educational-content'],
    queryFn: () => getEducationalContent({ page: 1, limit: 50 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['education-stats'],
    queryFn: getMyEducationStats,
  });

  // The backend refuses to complete content that was never started
  // ("You must start the content before completing it"), so the card has to
  // know where each item stands before it can offer the right control.
  const { data: progress } = useQuery({
    queryKey: ['education-progress'],
    queryFn: () => getMyEducationProgress({ page: 1, limit: 100 }),
  });

  const statusByContentId = new Map(
    (progress?.items ?? []).map((entry) => [entry.contentId, entry.status] as const),
  );

  const startMutation = useMutation({
    mutationFn: startContent,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
    onError: (err: Error) => setActionError(err.message || t('education.startFailed')),
  });

  const completeMutation = useMutation({
    mutationFn: completeContent,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['educational-content'] });
      void queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
    onError: (err: Error) => setActionError(err.message || t('education.completeFailed')),
  });

  const header = (
    <ScreenHeader
      title={t('education.title')}
      eyebrow={t('education.subtitle')}
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
        data={content?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: tabBarClearance,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        renderItem={({ item }) => (
          <EducationCard
            content={item}
            status={statusByContentId.get(item.id)}
            onStart={() => {
              setPendingId(item.id);
              startMutation.mutate(item.id);
            }}
            onComplete={() => {
              setPendingId(item.id);
              completeMutation.mutate(item.id);
            }}
            isStarting={startMutation.isPending && pendingId === item.id}
            isCompleting={completeMutation.isPending && pendingId === item.id}
          />
        )}
        ListHeaderComponent={
          <Stack gap="lg" style={{ paddingBottom: space.md }}>
            {stats ? (
              <SectionHeader title={t('education.yourProgress')} />
            ) : null}
            {stats ? (
              <StatRow>
                <Stat
                  label={t('education.completed')}
                  value={String(stats.totalCompleted)}
                  tone="success"
                />
                <Stat label={t('education.started')} value={String(stats.totalStarted)} />
                <Stat
                  label={t('education.xpEarned')}
                  value={String(stats.totalXpEarned)}
                  tone="insight"
                />
              </StatRow>
            ) : null}

            <SectionHeader title={t('education.availableContent')} />

            {actionError ? <Banner tone="critical" title={actionError} /> : null}
          </Stack>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('education.empty')}
            description={t('education.emptyHint')}
            icon={({ size, color }) => <BookOpen size={size} color={color} />}
          />
        }
      />
    </Screen>
  );
}

function EducationCard({
  content,
  status,
  onStart,
  onComplete,
  isStarting,
  isCompleting,
}: {
  content: EducationalContent;
  /** This donor's progress on this item; undefined means not started. */
  status?: 'STARTED' | 'COMPLETED';
  onStart: () => void;
  onComplete: () => void;
  isStarting: boolean;
  isCompleting: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useDesign();

  return (
    <Surface>
      <Stack gap="md">
        {/* Type and difficulty used to render as their enums -- "ARTICLE",
            "BEGINNER" -- in two badges above the title. */}
        <Row gap="xs" style={{ flexWrap: 'wrap' }}>
          <Badge label={t(`education.types.${content.type}`)} tone="clinical" />
          <Badge label={difficultyLabel(content.difficulty, t)} />
          {content.category ? <Badge label={content.category} /> : null}
        </Row>

        <Stack gap="xs">
          <Text variant="h3">{content.title}</Text>
          <Text variant="body" tone="secondary" numberOfLines={3}>
            {content.description}
          </Text>
        </Stack>

        <Row gap="lg" style={{ flexWrap: 'wrap' }}>
          {content.estimatedMinutes ? (
            <Row gap="xs">
              <Clock size={iconSize.sm} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                {t('education.minutes', { count: content.estimatedMinutes })}
              </Text>
            </Row>
          ) : null}
          {content.xpReward > 0 ? (
            <Row gap="xs">
              <Award size={iconSize.sm} color={colors.insight.base} />
              <Text variant="caption" tone="secondary">
                {`+${content.xpReward} ${t('profile.xp')}`}
              </Text>
            </Row>
          ) : null}
        </Row>

        {status === 'COMPLETED' ? (
          <Badge label={t('education.completed')} tone="success" />
        ) : status === 'STARTED' ? (
          <Button
            label={t('education.complete')}
            size="md"
            loading={isCompleting}
            icon={({ size, color }) => <CheckCircle size={size} color={color} />}
            onPress={onComplete}
          />
        ) : (
          <Button
            label={t('education.start')}
            variant="secondary"
            size="md"
            loading={isStarting}
            icon={({ size, color }) => <PlayCircle size={size} color={color} />}
            onPress={onStart}
          />
        )}
      </Stack>
    </Surface>
  );
}
