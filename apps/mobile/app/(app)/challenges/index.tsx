import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Clock, Award } from 'lucide-react-native';
import { getActiveChallenges, joinChallenge, type Challenge } from '../../../src/api/challenges';
import {
  AppButton,
  AppText,
  Badge,
  Card,
  EmptyState,
  GlassCard,
  LoadingState,
  ProgressBar,
  Screen,
  ScreenHeader,
} from '../../../src/components';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';

export default function ChallengesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: challenges, isLoading, refetch } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const joinMutation = useMutation({
    mutationFn: joinChallenge,
    onSuccess: () => {
      setJoinError(null);
      queryClient.invalidateQueries({ queryKey: ['active-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
    },
    onError: (err: any) => {
      setJoinError(err.message || t('challenges.joinFailed'));
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
        <ScreenHeader title={t('challenges.title')} />
        <LoadingState message={t('challenges.loading')} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('challenges.title')}
        subtitle={t('challenges.subtitle')}
      />
      <FlatList
        style={{ flex: 1 }}
        data={challenges ?? []}
        keyExtractor={(challenge) => challenge.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: challenge }) => (
          <ChallengeCard
            challenge={challenge}
            onJoin={() => joinMutation.mutate(challenge.id)}
            isJoining={joinMutation.isPending}
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
          joinError ? (
            <Card style={styles.errorCard}>
              <AppText style={{ color: colors.onMuted.danger }}>{joinError}</AppText>
            </Card>
          ) : null
        }
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon={Trophy}
              title={t('challenges.empty')}
              description={t('challenges.emptyHint')}
            />
          </Card>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const current = challenge.userProgress || 0;
  const progress = current / challenge.goal;
  const hasJoined = challenge.userProgress !== undefined;

  return (
    <GlassCard>
      <View style={styles.badgeRow}>
        <Badge variant="primary">{challenge.type}</Badge>
      </View>
      <AppText variant="heading">{challenge.title}</AppText>

      <AppText variant="bodySmall" style={styles.description} numberOfLines={3}>
        {challenge.description}
      </AppText>

      {challenge.endDate && (
        <View style={styles.detailRow}>
          <Clock size={16} color={colors.textMuted} />
          <AppText muted variant="bodySmall">
            {t('challenges.endsOn', { date: formatDate(challenge.endDate, 'medium') })}
          </AppText>
        </View>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <AppText muted variant="bodySmall">
            {t('table.progress')}
          </AppText>
          <AppText variant="bodySmall" style={styles.progressValue}>
            {current} / {challenge.goal}
          </AppText>
        </View>
        <ProgressBar progress={progress * 100} height={8} />
      </View>

      <View style={styles.rewards}>
        {challenge.xpReward > 0 && (
          <View style={styles.detailRow}>
            <Trophy size={18} color={colors.primary} />
            <AppText variant="bodySmall" style={styles.xpReward}>
              +{challenge.xpReward} XP
            </AppText>
          </View>
        )}

        {challenge.badge && (
          <View style={styles.detailRow}>
            <Award size={18} color={colors.primary} />
            <AppText variant="bodySmall">{challenge.badge.name}</AppText>
          </View>
        )}
      </View>

      {!hasJoined && (
        <AppButton onPress={onJoin} loading={isJoining} style={styles.action}>
          {t('challenges.joinChallenge')}
        </AppButton>
      )}

      {hasJoined && progress >= 1 && (
        <View style={styles.completed}>
          <AppText style={styles.completedText}>{t('challenges.completed')}</AppText>
        </View>
      )}
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorCard: {
      padding: spacing.md,
      marginBottom: layout.cardGap,
      backgroundColor: colors.dangerMuted,
    },
    list: {
      gap: layout.cardGap,
      paddingBottom: spacing.xl,
    },
    badgeRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    description: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    progressSection: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    progressValue: {
      fontWeight: '600',
    },
    rewards: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    xpReward: {
      fontWeight: '700',
      color: colors.primary,
    },
    action: {
      marginTop: spacing.md,
    },
    completed: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.sm,
      alignItems: 'center',
      backgroundColor: colors.successMuted,
    },
    completedText: {
      fontWeight: '700',
      color: colors.onMuted.success,
    },
  });
}
