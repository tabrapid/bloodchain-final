import { useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Clock, PlayCircle } from 'lucide-react-native';
import {
  getEducationalContent,
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
  LinkButton,
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
  const [actionError] = useState<string | null>(null);

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
            onOpen={() => router.push({ pathname: '/(app)/education/[id]', params: { id: item.id } })}
          />
        )}
        ListHeaderComponent={
          <Stack gap="lg" style={{ paddingBottom: space.md }}>
            {stats ? (
              <SectionHeader title={t('education.yourProgress')} />
            ) : null}
            {stats ? (
              <StatRow>
                {/* Lessons finished was green and XP was violet, next to a
                    plain "started". Green in this app means a check has
                    cleared and violet means a model produced something;
                    neither is true of a reading count, and a row where two of
                    three figures are coloured for no reason is how a reader
                    learns to stop reading the colours. */}
                <Stat label={t('education.completed')} value={String(stats.totalCompleted)} />
                <Stat label={t('education.started')} value={String(stats.totalStarted)} />
                <Stat label={t('education.xpEarned')} value={String(stats.totalXpEarned)} />
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
  onOpen,
}: {
  content: EducationalContent;
  /** This donor's progress on this item; undefined means not started. */
  status?: 'STARTED' | 'COMPLETED';
  onOpen: () => void;
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
              {/* Metadata, the same rank as the reading time beside it. */}
              <Award size={iconSize.sm} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                {`+${content.xpReward} ${t('profile.xp')}`}
              </Text>
            </Row>
          ) : null}
        </Row>

        {/*
          Every one of these opens the article.

          "Start" used to call the start endpoint and open nothing: the card
          flipped to "in progress" and then offered "Complete" for an article
          the app had never shown. The body has been in the payload all along.
        */}
        {status === 'COMPLETED' ? (
          <Row gap="sm" style={{ alignItems: 'center' }}>
            <Badge label={t('education.completed')} tone="success" />
            <LinkButton label={t('education.readAgain')} onPress={onOpen} />
          </Row>
        ) : (
          <Button
            label={status === 'STARTED' ? t('common.continue') : t('education.start')}
            variant={status === 'STARTED' ? 'primary' : 'secondary'}
            size="md"
            icon={({ size, color }) => <PlayCircle size={size} color={color} />}
            onPress={onOpen}
          />
        )}
      </Stack>
    </Surface>
  );
}
