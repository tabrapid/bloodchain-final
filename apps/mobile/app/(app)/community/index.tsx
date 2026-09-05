import React, { useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Share2 } from 'lucide-react-native';
import { getFeed, type CommunityPost } from '../../../src/api/community';
import { getUserRank } from '../../../src/api/gamification';
import {
  AppHeader,
  AppText,
  Avatar,
  Badge,
  GlassCard,
  IconButton,
  LoadingState,
  Screen,
} from '../../../src/components';
import { radius, spacing, useTheme, ThemeColors } from '../../../src/theme';

export default function CommunityScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => getFeed({ page: 1, limit: 20 }),
  });

  const { data: userRank } = useQuery({
    queryKey: ['leaderboard', 'me', 'THIS_MONTH'],
    queryFn: () => getUserRank('THIS_MONTH'),
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
    <Screen scroll={false}>
      <FlatList
        style={{ flex: 1 }}
        data={feed?.items ?? []}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => <FeedPostCard post={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <AppHeader
              title="Community"
              subtitle="Your donor network"
              trailing={
                <IconButton
                  icon={BookOpen}
                  onPress={() => router.push('/education')}
                  accessibilityLabel="Education"
                />
              }
            />

            {userRank && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/gamification/leaderboard')}
                style={styles.leaderboardTeaser}
              >
                <GlassCard elevated>
                  <View style={styles.leaderboardRow}>
                    <View style={styles.leaderboardIcon}>
                      <Award size={20} color={colors.onMuted.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.leaderboardTitle}>This month's leaderboard</AppText>
                      <AppText muted style={styles.tinyText}>
                        You're ranked #{userRank.rank} of {userRank.total} — keep going!
                      </AppText>
                    </View>
                    <Badge variant="warning">#{userRank.rank}</Badge>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            )}

            <AppText variant="heading" style={styles.feedHeading}>
              Community Feed
            </AppText>
          </>
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

function FeedPostCard({ post }: { post: CommunityPost }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authorName =
    post.author?.displayName || `${post.author?.firstName} ${post.author?.lastName}`;

  const handleShare = () => {
    Share.share({
      message: `${post.title}\n\n${post.body}`,
      title: post.title,
    }).catch(() => {});
  };

  return (
    <GlassCard style={styles.feedPost}>
      <View style={styles.feedPostHeader}>
        {post.author?.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Avatar name={post.author?.firstName || 'U'} size={38} />
        )}
        <View style={styles.feedPostAuthor}>
          <View style={styles.feedPostAuthorRow}>
            <AppText variant="bodySmall" style={styles.feedPostAuthorName}>
              {authorName}
            </AppText>
            <Badge variant="primary">{post.type}</Badge>
          </View>
          <AppText muted style={styles.tinyText}>
            {new Date(post.publishedAt).toLocaleDateString()}
          </AppText>
        </View>
      </View>

      <AppText style={styles.feedPostTitle}>{post.title}</AppText>
      <AppText muted variant="bodySmall" style={styles.feedPostBody}>
        {post.body}
      </AppText>

      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.feedPostImage} resizeMode="cover" />
      )}

      <TouchableOpacity style={styles.shareButton} activeOpacity={0.7} onPress={handleShare}>
        <Share2 size={15} color={colors.textMuted} />
        <AppText muted style={styles.tinyText}>
          Share
        </AppText>
      </TouchableOpacity>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    leaderboardTeaser: {
      marginBottom: spacing.md,
    },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    leaderboardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.warningMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderboardTitle: {
      fontSize: 13,
      fontWeight: '600',
    },
    tinyText: {
      fontSize: 11,
      lineHeight: 16,
    },
    feedHeading: {
      marginBottom: spacing.md,
    },
    listContent: {
      paddingBottom: spacing.xl,
    },
    feedPost: {
      marginBottom: spacing.md,
    },
    feedPostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    avatarImage: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
    },
    feedPostAuthor: {
      flex: 1,
    },
    feedPostAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
  });
}
