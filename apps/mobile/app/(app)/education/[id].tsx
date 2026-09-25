import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Award, CheckCircle, Clock } from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ErrorState,
  Row,
  ScreenHeader,
  ScrollScreen,
  Skeleton,
  Stack,
  Text,
  iconSize,
  useDesign,
} from '../../../src/design';
import {
  completeContent,
  getEducationalContentById,
  getMyEducationProgress,
  startContent,
} from '../../../src/api/education';
import { useTranslation } from '../../../src/i18n';

/** Difficulty is an enum in the payload; the list screen translates it the same way. */
function difficultyLabel(difficulty: string, t: (key: string) => string): string {
  const known = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  return known.includes(difficulty.toUpperCase())
    ? t(`education.difficulties.${difficulty.toUpperCase()}`)
    : difficulty;
}

/**
 * The article itself.
 *
 * Every piece of educational content has carried a `body` since the module
 * shipped -- a real article, fetched with the list and never rendered
 * anywhere. "Start" called `POST /education/:id/start`, the card flipped to
 * "in progress", and nothing opened: the donor was marked as having begun
 * reading something the app would not show them, and the only way forward was
 * a "Complete" button for an article they had never seen.
 *
 * So this screen reads it, and completion happens here, at the end of it, where
 * the donor has actually been through the thing they are claiming to have read.
 */
export default function EducationArticle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useDesign();
  const queryClient = useQueryClient();

  const { data: content, isPending, isError, refetch } = useQuery({
    queryKey: ['educational-content', id],
    queryFn: () => getEducationalContentById(id),
    enabled: Boolean(id),
  });

  const { data: progress } = useQuery({
    queryKey: ['education-progress'],
    queryFn: () => getMyEducationProgress(),
  });

  const status = (progress?.items ?? []).find((entry: { contentId: string }) => entry.contentId === id)?.status;

  const completeMutation = useMutation({
    mutationFn: () => completeContent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['education-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['me-gamification'] });
      router.back();
    },
  });

  // The backend refuses to complete content that was never started, so opening
  // the article records the start -- which is what "started" honestly means.
  const startMutation = useMutation({ mutationFn: () => startContent(id) });
  const started = status === 'STARTED' || status === 'COMPLETED' || startMutation.isSuccess;
  if (content && !status && !startMutation.isPending && !startMutation.isSuccess) {
    startMutation.mutate();
  }

  const header = (
    <ScreenHeader
      title={content?.title ?? t('education.title')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={28} />
          <Skeleton height={180} />
          <Skeleton height={120} />
        </Stack>
      </ScrollScreen>
    );
  }

  if (isError || !content) {
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

  return (
    <ScrollScreen header={header}>
      <Stack gap="xl">
        <Stack gap="md">
          <Row gap="xs" style={{ flexWrap: 'wrap' }}>
            <Badge label={t(`education.types.${content.type}`)} tone="clinical" />
            <Badge label={difficultyLabel(content.difficulty, t)} />
            {content.category ? <Badge label={content.category} /> : null}
          </Row>

          <Text variant="h1" accessibilityRole="header">
            {content.title}
          </Text>

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
        </Stack>

        <Text variant="body" tone="secondary">
          {content.description}
        </Text>

        {/*
          The article. The API sends plain text with paragraph breaks in it, so
          it is rendered as paragraphs rather than as one block -- and not as
          markdown, because nothing here says it is markdown and guessing would
          put asterisks on the glass.
        */}
        <Stack gap="md">
          {content.body
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, index) => (
              <Text key={index} variant="body">
                {paragraph}
              </Text>
            ))}
        </Stack>

        {completeMutation.isError ? (
          <Banner tone="critical" title={t('education.completeFailed')} />
        ) : null}

        {status === 'COMPLETED' ? (
          <Badge label={t('education.completed')} tone="success" />
        ) : (
          <Button
            label={t('education.complete')}
            loading={completeMutation.isPending}
            disabled={!started}
            icon={({ size, color }) => <CheckCircle size={size} color={color} />}
            onPress={() => completeMutation.mutate()}
          />
        )}
      </Stack>
    </ScrollScreen>
  );
}
