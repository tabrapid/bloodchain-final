import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
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
  GlassCard,
  LoadingState,
  Screen,
  ScreenHeader,
} from '../../../src/components';
import { spacing, useTheme, ThemeColors } from '../../../src/theme';

export default function EducationScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: content, isLoading, refetch } = useQuery({
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
      setActionError(err.message || 'Failed to start content. Please try again.');
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
      setActionError(err.message || 'Failed to complete content. Please try again.');
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
        <ScreenHeader title="Education Hub" />
        <LoadingState message="Loading content..." />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <ScreenHeader
        title="Education Hub"
        subtitle="Learn about blood donation and earn XP"
      />

      {stats && (
        <Card style={styles.statsCard}>
          <AppText variant="heading">Your Progress</AppText>
          <View style={styles.statsRow}>
            <EducationStat label="Completed" value={stats.totalCompleted} />
            <EducationStat label="Started" value={stats.totalStarted} />
            <EducationStat label="XP Earned" value={stats.totalXpEarned} />
          </View>
        </Card>
      )}

      <AppText variant="heading" style={styles.sectionTitle}>
        Available Content
      </AppText>

      {actionError && (
        <Card style={styles.errorCard}>
          <AppText style={{ color: colors.onMuted.danger }}>{actionError}</AppText>
        </Card>
      )}

      {content?.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No Content Available"
            description="Check back later for educational content"
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {content?.items.map((item) => (
            <EducationCard
              key={item.id}
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
          ))}
        </View>
      )}
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <GlassCard style={styles.card}>
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
              {content.estimatedMinutes} min
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
          <Badge variant="success">Completed</Badge>
        ) : status === 'STARTED' ? (
          <AppButton onPress={onComplete} loading={isCompleting} size="small">
            <CheckCircle size={16} color={colors.white} />
            Complete
          </AppButton>
        ) : (
          <AppButton onPress={onStart} loading={isStarting} size="small">
            <PlayCircle size={16} color={colors.white} />
            Start
          </AppButton>
        )}
      </View>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    errorCard: {
      padding: spacing.md,
      marginBottom: spacing.lg,
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
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    card: {
      padding: spacing.lg,
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
