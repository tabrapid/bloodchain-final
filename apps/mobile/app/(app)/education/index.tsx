import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Clock, Award, CheckCircle, PlayCircle } from 'lucide-react-native';
import {
  getEducationalContent,
  startContent,
  completeContent,
  getMyEducationProgress,
  getMyEducationStats,
  type EducationalContent,
} from '../../../src/api/education';
import {
  AppButton,
  AppText,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  Screen,
  ScreenHeader,
} from '../../../src/components';
import { layout, spacing, useTheme, ThemeColors } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';

export default function EducationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: content, isLoading, isError, refetch } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
    onError: (err: any) => {
      setActionError(err.message || t('education.startFailed'));
    },
  });

  const [pendingId, setPendingId] = useState<string | null>(null);

  const completeMutation = useMutation({
    mutationFn: completeContent,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['educational-content'] });
      queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
    onError: (err: any) => {
      setActionError(err.message || t('education.completeFailed'));
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('education.title')} />
        <LoadingState message={t('education.loading')} />
      </Screen>
    );
  }

  // A network failure used to render as an empty list, which reads as
  // "there are none" -- a different and wrong answer.
  if (isError) {
    return (
      <Screen>
        <ScreenHeader title={t('education.title')} />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('education.title')}
        subtitle={t('education.subtitle')}
      />
      <FlatList
        style={{ flex: 1 }}
        data={content?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {stats && (
              <GlassCard tier="elevated" style={styles.statsCard}>
                <AppText variant="heading">{t('education.yourProgress')}</AppText>
                <View style={styles.statsRow}>
                  <EducationStat label={t('education.completed')} value={stats.totalCompleted} />
                  <EducationStat label={t('education.started')} value={stats.totalStarted} />
                  <EducationStat label={t('education.xpEarned')} value={stats.totalXpEarned} />
                </View>
              </GlassCard>
            )}

            <AppText variant="heading" style={styles.sectionTitle}>
              {t('education.availableContent')}
            </AppText>

            {actionError && (
              <Card style={styles.errorCard}>
                <AppText style={{ color: colors.onMuted.danger }}>{actionError}</AppText>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon={BookOpen}
              title={t('education.empty')}
              description={t('education.emptyHint')}
            />
          </Card>
        }
      />
    </Screen>
  );
}

function EducationStat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <AppText variant="numeric" style={styles.statValue}>
        {value}
      </AppText>
      <AppText muted variant="bodySmall" style={styles.statLabel}>
        {label}
      </AppText>
    </View>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <GlassCard>
      <View style={styles.badgeRow}>
        <Badge variant="primary">{content.type}</Badge>
        <Badge>{content.difficulty}</Badge>
      </View>
      <AppText variant="heading">{content.title}</AppText>

      <AppText variant="bodySmall" style={styles.description} numberOfLines={3}>
        {content.description}
      </AppText>

      <View style={styles.meta}>
        {content.estimatedMinutes && (
          <View style={styles.detailRow}>
            <Clock size={16} color={colors.textMuted} />
            <AppText muted variant="bodySmall">
              {t('education.minutes', { count: content.estimatedMinutes })}
            </AppText>
          </View>
        )}

        {content.xpReward > 0 && (
          <View style={styles.detailRow}>
            <Award size={16} color={colors.primary} />
            <AppText variant="bodySmall" style={styles.xpReward}>
              +{content.xpReward} XP
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Badge>{content.category}</Badge>

        {status === 'COMPLETED' ? (
          <Badge variant="success">{t('education.completed')}</Badge>
        ) : status === 'STARTED' ? (
          <AppButton onPress={onComplete} loading={isCompleting} size="small">
            <CheckCircle size={16} color={colors.white} />
            {t('education.complete')}
          </AppButton>
        ) : (
          <AppButton onPress={onStart} loading={isStarting} size="small">
            <PlayCircle size={16} color={colors.white} />
            {t('education.start')}
          </AppButton>
        )}
      </View>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsCard: {
      marginBottom: layout.cardGap,
    },
    errorCard: {
      padding: spacing.md,
      marginBottom: layout.cardGap,
      backgroundColor: colors.dangerMuted,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    stat: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 28,
      lineHeight: 34,
      color: colors.primary,
    },
    statLabel: {
      marginTop: spacing.xs,
    },
    sectionTitle: {
      marginBottom: spacing.md,
    },
    list: {
      gap: layout.cardGap,
      paddingBottom: spacing.xl,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    description: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    xpReward: {
      fontWeight: '600',
      color: colors.primary,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
  });
}
