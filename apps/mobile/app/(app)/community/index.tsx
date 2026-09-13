import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  ChevronRight,
  Droplet,
  GraduationCap,
  Megaphone,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react-native';
import { getFeed, getImpactStats, type CommunityPost } from '../../../src/api/community';
import { getUserRank } from '../../../src/api/gamification';
import {
  AppText,
  Avatar,
  GlassCard,
  GradientCard,
  IconButton,
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../src/components';
import { LucideIcon } from '../../../src/types/icons';
import { layout, radius, spacing, useTheme, ThemeColors } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';

type AccentKey = 'primary' | 'secondary' | 'success' | 'warning' | 'ai';

/**
 * What each kind of post is, as an icon and an accent.
 *
 * The type used to render as the raw enum value in a rose badge --
 * "COMMUNITY_UPDATE" shouted at the reader beside every author's name. A
 * shaped label and a colour carry the same fact without taking over the card.
 */
const POST_TYPES: Record<string, { labelKey: string; icon: LucideIcon; accent: AccentKey }> = {
  CAMPAIGN: { labelKey: 'community.postTypes.campaign', icon: Droplet, accent: 'primary' },
  EDUCATION: { labelKey: 'community.education', icon: GraduationCap, accent: 'secondary' },
  MILESTONE: { labelKey: 'community.postTypes.milestone', icon: Trophy, accent: 'warning' },
  ACHIEVEMENT: { labelKey: 'community.postTypes.achievement', icon: Award, accent: 'warning' },
  COMMUNITY_UPDATE: { labelKey: 'community.postTypes.update', icon: Users, accent: 'ai' },
  ANNOUNCEMENT: { labelKey: 'community.postTypes.announcement', icon: Megaphone, accent: 'ai' },
  IMPACT: { labelKey: 'community.impact', icon: Sparkles, accent: 'success' },
};

/** "today" / "3 days ago" / "12 Mar". */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export default function CommunityScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
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

  const { data: impact, refetch: refetchImpact } = useQuery({
    queryKey: ['community', 'impact'],
    queryFn: getImpactStats,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFeed(), refetchImpact()]);
    setRefreshing(false);
  };

  if (feedLoading) {
    return (
      <Screen>
        <LoadingState message={t('common.loading')} />
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <AppText style={styles.title}>{t('community.title')}</AppText>
                <AppText muted style={styles.subtitle}>
                  {t('community.subtitle')}
                </AppText>
              </View>
              <IconButton
                icon={BookOpen}
                onPress={() => router.push('/education')}
                accessibilityRole="button"
                accessibilityLabel={t('community.education')}
              />
            </View>

            {/*
              The hero leads with the donor's own standing, because that is the
              question this tab answers first. It used to be a thin teaser
              strip under the header, and the screen opened on a wall of posts
              with no sense of where you stood in it.
            */}
            {userRank && (
              <Pressable
                onPress={() => router.push('/gamification/leaderboard')}
                accessibilityRole="button"
                accessibilityLabel={`You are ranked ${userRank.rank} of ${userRank.total} this month. Open the leaderboard`}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <GradientCard colors={['#D85360', '#7B3266']} style={styles.hero}>
                  <View style={styles.heroTopRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.heroEyebrow}>{t('community.thisMonth')}</AppText>
                      <View style={styles.heroRankRow}>
                        <AppText style={styles.heroRank}>#{userRank.rank}</AppText>
                        <AppText style={styles.heroRankOf}>of {userRank.total} donors</AppText>
                      </View>
                    </View>
                    <View style={styles.heroTrophy}>
                      <Trophy size={26} color="#FFFFFF" strokeWidth={1.6} />
                    </View>
                  </View>

                  {impact && (
                    <>
                      <View style={styles.heroDivider} />
                      <View style={styles.heroStatsRow}>
                        <HeroStat value={impact.donations} label={t('community.donations')} />
                        <HeroStat value={impact.campaignParticipations} label={t('community.campaigns')} />
                        <HeroStat value={impact.challengeCompletions} label={t('community.challenges')} />
                      </View>
                    </>
                  )}

                  <View style={styles.heroFooter}>
                    <AppText style={styles.heroFooterText}>{t('community.leaderboard')}</AppText>
                    <ChevronRight size={16} color="rgba(255,255,255,0.85)" />
                  </View>
                </GradientCard>
              </Pressable>
            )}

            <SectionHeader>{t('community.feed')}</SectionHeader>
          </>
        }
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            <AppText style={styles.emptyTitle}>{t('community.empty')}</AppText>
            <AppText muted style={styles.emptyNote}>
              {t('community.emptyBody')}
            </AppText>
          </GlassCard>
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={{ flex: 1 }}>
      <AppText style={styles.heroStatValue}>{value}</AppText>
      <AppText style={styles.heroStatLabel}>{label}</AppText>
    </View>
  );
}

function FeedPostCard({ post }: { post: CommunityPost }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authorName =
    post.author?.displayName ||
    [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') ||
    'Bloodchain';
  const type = POST_TYPES[post.type] ?? { labelKey: post.type, icon: Megaphone, accent: 'ai' as const };
  const TypeIcon = type.icon;
  const accent = colors[type.accent];

  const handleShare = () => {
    Share.share({ message: `${post.title}\n\n${post.body}`, title: post.title }).catch(() => {});
  };

  return (
    <GlassCard style={styles.feedPost}>
      <View style={styles.feedPostHeader}>
        {post.author?.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Avatar name={authorName} size={38} />
        )}
        <View style={{ flex: 1 }}>
          <AppText style={styles.feedPostAuthorName} numberOfLines={1}>
            {authorName}
          </AppText>
          <AppText muted style={styles.tinyText}>
            {formatWhen(post.publishedAt)}
          </AppText>
        </View>
        <View style={[styles.typePill, { backgroundColor: `${accent}26`, borderColor: `${accent}40` }]}>
          <TypeIcon size={12} color={accent} />
          <AppText style={[styles.typeLabel, { color: accent }]}>{t(type.labelKey)}</AppText>
        </View>
      </View>

      <AppText style={styles.feedPostTitle}>{post.title}</AppText>
      <AppText muted style={styles.feedPostBody}>
        {post.body}
      </AppText>

      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.feedPostImage} resizeMode="cover" />
      )}

      {/* A chip, not an icon with a word beside it: bare text on a card gives
          nothing to aim at and no sign that it is pressable at all. */}
      <Pressable
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel={`Share: ${post.title}`}
        style={({ pressed }) => [styles.shareButton, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Share2 size={14} color={colors.textMuted} />
        <AppText muted style={styles.shareLabel}>
          {t('common.share')}
        </AppText>
      </Pressable>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -1,
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      marginTop: 2,
    },

    hero: {
      marginBottom: 0,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.6,
      color: 'rgba(255,255,255,0.8)',
    },
    heroRankRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 2,
    },
    heroRank: {
      fontSize: 40,
      lineHeight: 46,
      fontWeight: '800',
      letterSpacing: -1.6,
      color: '#FFFFFF',
    },
    heroRankOf: {
      fontSize: 14,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.8)',
    },
    heroTrophy: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    heroDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginVertical: spacing.md,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    heroStatValue: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.78)',
      marginTop: 1,
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.md,
    },
    heroFooterText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
    },

    listContent: {
      paddingBottom: spacing.xl,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    emptyNote: {
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      textAlign: 'center',
    },

    feedPost: {
      marginBottom: layout.cardGap,
    },
    feedPostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    avatarImage: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
    },
    feedPostAuthorName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    tinyText: {
      fontSize: 11,
      lineHeight: 16,
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 24,
      paddingHorizontal: 9,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    typeLabel: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    feedPostTitle: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 21,
      color: colors.text,
    },
    feedPostBody: {
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 4,
    },
    feedPostImage: {
      width: '100%',
      height: 180,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      minHeight: 32,
      paddingHorizontal: 12,
      marginTop: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shareLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
