import React, { useState } from 'react';
import { FlatList, Image, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  ChevronRight,
  Droplet,
  Flag,
  GraduationCap,
  Megaphone,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react-native';
import {
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Choice,
  EmptyState,
  ErrorState,
  IconButton,
  LinkButton,
  ListGroup,
  ListRow,
  Row,
  Screen,
  ScreenTitle,
  Section,
  Sections,
  SkeletonCard,
  Stat,
  StatRow,
  Surface,
  Text,
  ValueText,
  iconSize,
  layout,
  radius,
  space,
  useDesign,
  type StatusTone,
  useTabBarClearance,
} from '../../../src/design';
import {
  getFeed,
  getImpactStats,
  reportContent,
  type CommunityPost,
} from '../../../src/api/community';
import { getUserRank } from '../../../src/api/gamification';
import { LucideIcon } from '../../../src/types/icons';
import { useTranslation } from '../../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

/**
 * The reasons `ReportContentDto` accepts, in the order a reader scans them.
 * Keys, not words -- the labels are looked up per render.
 */
const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'MISINFORMATION', 'INAPPROPRIATE', 'OTHER'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * What each kind of post is, as an icon and an accent.
 *
 * One accent survives: a campaign is the only post type that asks the donor
 * to do something, so it is rose. The other six are news and take the neutral
 * chip, told apart by their icon and their translated label.
 */
const POST_TYPES: Record<string, { labelKey: string; icon: LucideIcon; tone: StatusTone }> = {
  CAMPAIGN: { labelKey: 'community.postTypes.campaign', icon: Droplet, tone: 'rose' },
  EDUCATION: { labelKey: 'community.education', icon: GraduationCap, tone: 'neutral' },
  MILESTONE: { labelKey: 'community.postTypes.milestone', icon: Trophy, tone: 'neutral' },
  ACHIEVEMENT: { labelKey: 'community.postTypes.achievement', icon: Award, tone: 'neutral' },
  COMMUNITY_UPDATE: { labelKey: 'community.postTypes.update', icon: Users, tone: 'neutral' },
  ANNOUNCEMENT: { labelKey: 'community.postTypes.announcement', icon: Megaphone, tone: 'neutral' },
  IMPACT: { labelKey: 'community.impact', icon: Sparkles, tone: 'neutral' },
};

/** "today" / "3 days ago" / "12 Mar", in the donor's language. */
function formatWhen(
  iso: string,
  t: TranslateFn,
  formatDate: (value: string, style?: 'full' | 'long' | 'medium' | 'short') => string,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.daysAgo', { count: days });
  return formatDate(iso, 'medium');
}

/**
 * Community, composed for V4.
 *
 * The product rule for this screen is the hardest one: donating blood is not
 * a game, and recognition must not make it feel like one. So standing is
 * stated plainly -- a rank among named donors, three counts -- on one quiet
 * surface; the three destinations (campaigns, challenges, education) are
 * rows; and the feed is a column of posts with the author, the kind of post
 * and the two actions a reader has.
 */
export default function CommunityScreen() {
  const tabBarClearance = useTabBarClearance();
  const { colors } = useDesign();
  const { t } = useTranslation();
  const [reporting, setReporting] = useState<CommunityPost | null>(null);
  // Accusing another donor is a two-step action: pick a reason, then confirm.
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [outcome, setOutcome] = useState<'sent' | 'failed' | null>(null);

  const feed = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => getFeed({ page: 1, limit: 20 }),
  });
  const userRank = useQuery({
    queryKey: ['leaderboard', 'me', 'THIS_MONTH'],
    queryFn: () => getUserRank('THIS_MONTH'),
  });
  const impact = useQuery({
    queryKey: ['community', 'impact'],
    queryFn: getImpactStats,
  });

  const onRefresh = () => {
    void feed.refetch();
    void userRank.refetch();
    void impact.refetch();
  };

  const submitReport = () => {
    const post = reporting;
    const reason = reportReason;
    if (!post || !reason) return;
    setReporting(null);
    setReportReason(null);
    reportContent(post.id, reason)
      .then(() => setOutcome('sent'))
      .catch(() => setOutcome('failed'));
  };

  const listHeader = (
    <Sections rhythm="major" style={{ paddingBottom: space.lg }}>
      <ScreenTitle
        title={t('community.title')}
        subtitle={t('community.subtitle')}
        action={
          <IconButton
            accessibilityLabel={t('community.education')}
            onPress={() => router.push('/education')}
            variant="surface"
            icon={({ size, color }) => <BookOpen size={size} color={color} />}
          />
        }
      />

      {/* ------------------------------------------------- where you stand */}
      {userRank.data ? (
        <Surface
          onPress={() => router.push('/gamification/leaderboard')}
          accessibilityLabel={`${t('community.thisMonth')}. ${t('community.rankOf', {
            rank: userRank.data.rank,
            count: userRank.data.total,
          })}. ${t('community.leaderboard')}`}
        >
          <View style={{ gap: space.lg }}>
            <Row gap="md" align="flex-start">
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('community.thisMonth')}
                </Text>
                <Row gap="sm" align="baseline">
                  <ValueText>{`#${userRank.data.rank}`}</ValueText>
                  <Text variant="body" tone="secondary">
                    {t('community.ofDonors', { count: userRank.data.total })}
                  </Text>
                </Row>
              </View>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <Trophy size={iconSize.md} color={colors.textSecondary} strokeWidth={1.75} />
              </View>
            </Row>

            {impact.data ? (
              <StatRow bare>
                <Stat label={t('community.donations')} value={String(impact.data.donations)} size="sm" />
                <Stat
                  label={t('community.campaigns')}
                  value={String(impact.data.campaignParticipations)}
                  size="sm"
                />
                <Stat
                  label={t('community.challenges')}
                  value={String(impact.data.challengeCompletions)}
                  size="sm"
                />
              </StatRow>
            ) : null}

            <Row gap="sm">
              <Text variant="label" tone="clinical" style={{ flex: 1 }}>
                {t('community.leaderboard')}
              </Text>
              <ChevronRight size={iconSize.sm} color={colors.textTertiary} />
            </Row>
          </View>
        </Surface>
      ) : null}

      {/* ----------------------------------------------- the three places */}
      <ListGroup
        rows={[
          <ListRow
            key="campaigns"
            icon={({ size, color }) => <Droplet size={size} color={color} />}
            iconTone="rose"
            title={t('community.campaigns')}
            onPress={() => router.push('/campaigns')}
          />,
          <ListRow
            key="challenges"
            icon={({ size, color }) => <Award size={size} color={color} />}
            title={t('community.challenges')}
            onPress={() => router.push('/challenges')}
          />,
          <ListRow
            key="education"
            icon={({ size, color }) => <GraduationCap size={size} color={color} />}
            iconTone="clinical"
            title={t('community.education')}
            onPress={() => router.push('/education')}
          />,
        ]}
      />

      <Section title={t('community.feed')}>{null}</Section>
    </Sections>
  );

  return (
    <Screen gutter={false} topPadding>
      {outcome ? (
        <View
          style={{
            position: 'absolute',
            top: space.md,
            left: layout.gutter,
            right: layout.gutter,
            zIndex: 10,
          }}
        >
          <Banner
            tone={outcome === 'sent' ? 'success' : 'critical'}
            title={outcome === 'sent' ? t('community.reportThanks') : t('community.reportFailed')}
            description={outcome === 'sent' ? t('community.reportThanksBody') : undefined}
            action={
              <Button
                label={t('common.close')}
                variant="secondary"
                size="sm"
                block={false}
                onPress={() => setOutcome(null)}
              />
            }
          />
        </View>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={feed.data?.items ?? []}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <FeedPost post={item} onReport={() => setReporting(item)} />
        )}
        showsVerticalScrollIndicator={false}
        refreshing={feed.isRefetching}
        onRefresh={onRefresh}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          feed.isPending ? (
            <View style={{ gap: space.md }}>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
            </View>
          ) : feed.isError ? (
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void feed.refetch()}
            />
          ) : (
            <EmptyState
              size="compact"
              title={t('community.empty')}
              description={t('community.emptyBody')}
              icon={({ size, color }) => <Users size={size} color={color} />}
            />
          )
        }
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: tabBarClearance,
          gap: space.md,
        }}
      />

      <BottomSheet
        visible={reporting !== null}
        onClose={() => {
          setReporting(null);
          setReportReason(null);
        }}
        title={t('community.reportTitle')}
        description={t('community.reportBody')}
        closeLabel={t('common.close')}
      >
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            {REPORT_REASONS.map((reason) => (
              <Choice
                key={reason}
                label={t(`community.reportReasons.${reason}`)}
                selected={reportReason === reason}
                onPress={() => setReportReason(reason)}
              />
            ))}
          </View>
          <Button
            label={t('community.report')}
            accent="critical"
            disabled={reportReason === null}
            onPress={submitReport}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function FeedPost({ post, onReport }: { post: CommunityPost; onReport: () => void }) {
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();

  const authorName =
    post.author?.displayName ||
    [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') ||
    'Bloodchain';
  const type = POST_TYPES[post.type] ?? {
    labelKey: post.type,
    icon: Megaphone,
    tone: 'neutral' as const,
  };
  const TypeIcon = type.icon;

  const share = () => {
    Share.share({ message: `${post.title}\n\n${post.body}`, title: post.title }).catch(() => {});
  };

  return (
    <Surface>
      <View style={{ gap: space.md }}>
        <Row gap="sm">
          {post.author?.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
              accessibilityIgnoresInvertColors
              style={{ width: 36, height: 36, borderRadius: radius.full }}
            />
          ) : (
            <Avatar name={authorName} size={36} />
          )}
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {authorName}
            </Text>
            <Text variant="caption" tone="tertiary">
              {formatWhen(post.publishedAt, t, formatDate)}
            </Text>
          </View>
          <Badge
            label={t(type.labelKey)}
            tone={type.tone}
            icon={({ size, color }) => <TypeIcon size={size} color={color} />}
          />
        </Row>

        <View style={{ gap: space.xs }}>
          <Text variant="title">{post.title}</Text>
          <Text variant="body" tone="secondary">
            {post.body}
          </Text>
        </View>

        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            style={{ width: '100%', height: 180, borderRadius: radius.md }}
          />
        ) : null}

        <Row gap="lg" style={{ paddingTop: space.xs, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <LinkButton
            label={t('common.share')}
            tone="secondary"
            accessibilityLabel={t('community.a11yShare', { title: post.title })}
            icon={({ size, color }) => <Share2 size={size} color={color} />}
            onPress={share}
          />
          <LinkButton
            label={t('community.report')}
            tone="secondary"
            accessibilityLabel={t('community.a11yReport', { title: post.title })}
            icon={({ size, color }) => <Flag size={size} color={color} />}
            onPress={onReport}
          />
        </Row>
      </View>
    </Surface>
  );
}
