import React, { useState } from 'react';
import { Image, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Users, Calendar, BookOpen, TrendingUp, Award } from 'lucide-react-native';
import {
  getFeed,
  getImpactStats,
  type CommunityPost,
} from '../../../src/api/community';
import { getActiveChallenges, type Challenge } from '../../../src/api/challenges';
import { getCampaigns, type Campaign } from '../../../src/api/campaigns';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  Divider,
  LoadingState,
  ProgressBar,
  Screen,
} from '../../../src/components';
import { colors, radius, spacing } from '../../../src/theme';

export default function CommunityScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => getFeed({ page: 1, limit: 20 }),
  });

  const { data: impactStats } = useQuery({
    queryKey: ['impact-stats'],
    queryFn: getImpactStats,
  });

  const { data: activeChallenges } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['active-campaigns'],
    queryFn: () => getCampaigns({ page: 1, limit: 5, status: 'ACTIVE' }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFeed()]);
    setRefreshing(false);
  };

  if (feedLoading) {
    return (
      <Screen>
        <LoadingState message="Loading community..." />
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
      {impactStats && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={24} color={colors.primary} />
            <AppText variant="heading">Your Impact</AppText>
          </View>

          <View style={styles.statsGrid}>
            <ImpactStat
              icon={<Award size={20} color={colors.primary} />}
              label="Donations"
              value={impactStats.donations}
            />
            <ImpactStat
              icon={<Users size={20} color={colors.primary} />}
              label="Campaigns"
              value={impactStats.campaignParticipations}
            />
            <ImpactStat
              icon={<Trophy size={20} color={colors.primary} />}
              label="Challenges"
              value={impactStats.challengeCompletions}
            />
            <ImpactStat
              icon={<BookOpen size={20} color={colors.primary} />}
              label="Education"
              value={impactStats.educationCompletions}
            />
          </View>

          <Divider />

          <View style={styles.totalsRow}>
            <View>
              <AppText muted variant="bodySmall">
                Level
              </AppText>
              <AppText variant="heading">{impactStats.level}</AppText>
            </View>
            <View>
              <AppText muted variant="bodySmall">
                XP
              </AppText>
              <AppText variant="heading">{impactStats.xp}</AppText>
            </View>
            <View>
              <AppText muted variant="bodySmall">
                Reputation
              </AppText>
              <AppText variant="heading">{impactStats.reputation}</AppText>
            </View>
          </View>
        </Card>
      )}

      {activeChallenges && activeChallenges.length > 0 && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={24} color={colors.primary} />
            <AppText variant="heading">Active Challenges</AppText>
          </View>
          <View style={styles.itemList}>
            {activeChallenges.slice(0, 3).map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </View>
        </Card>
      )}

      {campaigns && campaigns.items.length > 0 && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={24} color={colors.primary} />
            <AppText variant="heading">Active Campaigns</AppText>
          </View>
          <View style={styles.itemList}>
            {campaigns.items.slice(0, 3).map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </View>
        </Card>
      )}

      <Card style={styles.section}>
        <AppText variant="heading">Community Feed</AppText>
        <View style={styles.feedList}>
          {feed?.items.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function ImpactStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.impactStat}>
      <View style={styles.impactStatLabel}>
        {icon}
        <AppText muted variant="bodySmall">
          {label}
        </AppText>
      </View>
      <AppText variant="heading" style={styles.impactStatValue}>
        {value}
      </AppText>
    </View>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const current = challenge.userProgress || 0;
  const progress = current / challenge.goal;

  return (
    <TouchableOpacity
      style={styles.nestedCard}
      activeOpacity={0.8}
      onPress={() => router.push('/challenges')}
    >
      <AppText style={styles.nestedTitle}>{challenge.title}</AppText>
      <AppText muted variant="bodySmall" style={styles.nestedDescription} numberOfLines={2}>
        {challenge.description}
      </AppText>

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <AppText muted style={styles.tinyText}>
            Progress
          </AppText>
          <AppText style={[styles.tinyText, styles.tinyTextStrong]}>
            {current} / {challenge.goal}
          </AppText>
        </View>
        <ProgressBar progress={progress * 100} height={6} />
      </View>

      {challenge.xpReward > 0 && (
        <View style={styles.iconRow}>
          <Trophy size={14} color={colors.primary} />
          <AppText style={[styles.tinyText, styles.xpReward]}>+{challenge.xpReward} XP</AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <TouchableOpacity
      style={styles.nestedCard}
      activeOpacity={0.8}
      onPress={() => router.push('/campaigns')}
    >
      <AppText style={styles.nestedTitle}>{campaign.title}</AppText>
      <AppText muted variant="bodySmall" style={styles.nestedDescription} numberOfLines={2}>
        {campaign.description}
      </AppText>

      <View style={styles.iconRow}>
        <Calendar size={14} color={colors.textMuted} />
        <AppText muted style={styles.tinyText}>
          {new Date(campaign.startDate).toLocaleDateString()} -{' '}
          {new Date(campaign.endDate).toLocaleDateString()}
        </AppText>
      </View>

      {campaign.participantCount && (
        <View style={styles.iconRow}>
          <Users size={14} color={colors.textMuted} />
          <AppText muted style={styles.tinyText}>
            {campaign.participantCount} participants
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

function FeedPostCard({ post }: { post: CommunityPost }) {
  const authorName =
    post.author?.displayName || `${post.author?.firstName} ${post.author?.lastName}`;

  return (
    <View style={styles.feedPost}>
      <View style={styles.feedPostHeader}>
        {post.author?.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Avatar name={post.author?.firstName || 'U'} size={32} />
        )}
        <View style={styles.feedPostAuthor}>
          <AppText variant="bodySmall" style={styles.feedPostAuthorName}>
            {authorName}
          </AppText>
          <AppText muted style={styles.tinyText}>
            {new Date(post.publishedAt).toLocaleDateString()}
          </AppText>
        </View>
        <Badge variant="primary">{post.type}</Badge>
      </View>

      <AppText style={styles.feedPostTitle}>{post.title}</AppText>
      <AppText muted variant="bodySmall" style={styles.feedPostBody}>
        {post.body}
      </AppText>

      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.feedPostImage} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  impactStat: {
    width: '50%',
    marginBottom: spacing.md,
  },
  impactStatLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  impactStatValue: {
    marginTop: spacing.xs,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  itemList: {
    gap: spacing.md,
  },
  nestedCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  nestedTitle: {
    fontWeight: '600',
  },
  nestedDescription: {
    marginTop: spacing.xs,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tinyText: {
    fontSize: 11,
    lineHeight: 16,
  },
  tinyTextStrong: {
    fontWeight: '600',
  },
  xpReward: {
    fontWeight: '600',
    color: colors.primary,
  },
  feedList: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  feedPost: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  feedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
  },
  feedPostAuthor: {
    flex: 1,
  },
  feedPostAuthorName: {
    fontWeight: '600',
  },
  feedPostTitle: {
    fontWeight: '600',
  },
  feedPostBody: {
    marginTop: spacing.xs,
  },
  feedPostImage: {
    width: '100%',
    height: 192,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
});
