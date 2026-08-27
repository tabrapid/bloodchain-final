import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
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
} from '../../../src/components';
import { colors, spacing, radius } from '../../../src/theme';

export default function ChallengesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: challenges, isLoading, refetch } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const joinMutation = useMutation({
    mutationFn: joinChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
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
        <LoadingState message="Loading challenges..." />
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
      <View style={styles.header}>
        <AppText variant="title">Challenges</AppText>
        <AppText muted variant="bodySmall" style={styles.subtitle}>
          Complete challenges to earn XP and badges
        </AppText>
      </View>

      {challenges?.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="No Active Challenges"
            description="Check back later for new challenges"
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {challenges?.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onJoin={() => joinMutation.mutate(challenge.id)}
              isJoining={joinMutation.isPending}
            />
          ))}
        </View>
      )}
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
  const current = challenge.userProgress || 0;
  const progress = current / challenge.goal;
  const hasJoined = challenge.userProgress !== undefined;

  return (
    <GlassCard style={styles.card}>
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
            Ends {new Date(challenge.endDate).toLocaleDateString()}
          </AppText>
        </View>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <AppText muted variant="bodySmall">
            Progress
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
          Join Challenge
        </AppButton>
      )}

      {hasJoined && progress >= 1 && (
        <View style={styles.completed}>
          <AppText style={styles.completedText}>Challenge Completed!</AppText>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
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
    backgroundColor: '#10221F',
  },
  completedText: {
    fontWeight: '700',
    color: colors.success,
  },
});
