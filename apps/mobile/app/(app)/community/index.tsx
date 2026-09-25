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
  EmptyState,
  ErrorState,
  IconButton,
  Row,
  Screen,
  SectionHeader,
  SkeletonRow,
  Stack,
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
  type AccentName,
  useTabBarClearance,
  Choice,
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
 * The type used to render as the raw enum value in a rose badge --
 * "COMMUNITY_UPDATE" shouted at the reader beside every author's name. A
 * shaped label and a colour carry the same fact without taking over the card.
 */
const POST_TYPES: Record<string, { labelKey: string; icon: LucideIcon; tone: AccentName }> = {
  CAMPAIGN: { labelKey: 'community.postTypes.campaign', icon: Droplet, tone: 'rose' },
  EDUCATION: { labelKey: 'community.education', icon: GraduationCap, tone: 'clinical' },
  MILESTONE: { labelKey: 'community.postTypes.milestone', icon: Trophy, tone: 'warning' },
  ACHIEVEMENT: { labelKey: 'community.postTypes.achievement', icon: Award, tone: 'warning' },
  COMMUNITY_UPDATE: { labelKey: 'community.postTypes.update', icon: Users, tone: 'insight' },
  ANNOUNCEMENT: { labelKey: 'community.postTypes.announcement', icon: Megaphone, tone: 'insight' },
  IMPACT: { labelKey: 'community.impact', icon: Sparkles, tone: 'success' },
};

/**
 * "today" / "3 days ago" / "12 Mar", in the donor's language.
 *
 * The three words and the date format were all hardcoded English, on a feed
 * whose posts are in Uzbek.
 */
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
 * Community, rebuilt for V2.
 *
 * The product rule for this screen is the hardest one in the sprint: donating
 * blood is not a game, and recognition must not make it feel like one. V1's
 * answer was a rose-to-plum gradient with a 40pt `#1`, a trophy in a tinted
 * square and three white statistics under a rule -- the visual language of a
 * mobile game's season pass, attached to a medical act.
 *
 * V2 keeps every number and states them plainly. Standing is a rank among
 * named donors on an ordinary surface; the three counts are the same three
 * counts. Nothing is celebrated at the donor, and nothing was removed.
 *
 * Two things this screen did badly:
 *
 *   `of ${userRank.total} donors` and `Share: ${post.title}` were English
 *   literals, the second of them the only thing a screen reader announces for
 *   that button.
 *
 *   Reporting a post ran through three chained `Alert.alert` calls -- a
 *   five-option action sheet, then a success alert, then possibly a failure
 *   alert. On Android that is a stack of system dialogs with no styling and no
 *   way back; the outcome is a sheet and a banner now.
 */
export default function CommunityScreen() {
  const tabBarClearance = useTabBarClearance();
  const { colors } = useDesign();
  const { t } = useTranslation();
  const [reporting, setReporting] = useState<CommunityPost | null>(null);
  // Accusing another donor is a two-step action: pick a reason, then confirm.
  // It used to commit on a single tap of a list row carrying a chevron, which
  // everywhere else in this app means "opens something".
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

  const header = (
    <Row align="flex-start" gap="md" style={{ paddingTop: space.md, paddingBottom: space.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h1">{t('community.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('community.subtitle')}
        </Text>
      </View>
      <IconButton
        accessibilityLabel={t('community.education')}
        onPress={() => router.push('/education')}
        variant="surface"
        icon={({ size, color }) => <BookOpen size={size} color={color} />}
      />
    </Row>
  );

  const listHeader = (
    <Stack gap="xl" style={{ paddingBottom: space.lg }}>
      {header}

      {/* ------------------------------------------------- where you stand */}
      {userRank.data ? (
        <Surface
          onPress={() => router.push('/gamification/leaderboard')}
          accessibilityLabel={`${t('community.thisMonth')}. ${t('community.rankOf', {
            rank: userRank.data.rank,
            count: userRank.data.total,
          })}. ${t('community.leaderboard')}`}
        >
          <Stack gap="lg">
            <Row gap="md" align="flex-start">
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('community.thisMonth')}
                </Text>
                <Row gap="sm" align="baseline">
                  <ValueText variant="display">{`#${userRank.data.rank}`}</ValueText>
                  <Text variant="body" tone="secondary">
                    {t('community.ofDonors', { count: userRank.data.total })}
                  </Text>
                </Row>
              </View>
              <Trophy size={iconSize.lg} color={colors.textTertiary} strokeWidth={1.6} />
            </Row>

            {impact.data ? (
              <StatRow>
                <Stat label={t('community.donations')} value={String(impact.data.donations)} />
                <Stat
                  label={t('community.campaigns')}
                  value={String(impact.data.campaignParticipations)}
                />
                <Stat
                  label={t('community.challenges')}
                  value={String(impact.data.challengeCompletions)}
                />
              </StatRow>
            ) : null}

            <Row gap="sm">
              <Text variant="label" tone="clinical" style={{ flex: 1 }}>
                {t('community.leaderboard')}
              </Text>
              <ChevronRight size={iconSize.sm} color={colors.textTertiary} />
            </Row>
          </Stack>
        </Surface>
      ) : null}

      <SectionHeader title={t('community.feed')} />
    </Stack>
  );

  return (
    <Screen gutter={false} topPadding>
      {/*
        Over the list, not inside its header.

        Reporting a post from halfway down the feed closed the sheet and put
        the confirmation at the very top of the list, where the donor could not
        see it: the report either worked or failed in silence.
      */}
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
                size="md"
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
            <Surface>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </Surface>
          ) : feed.isError ? (
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void feed.refetch()}
            />
          ) : (
            <EmptyState
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

      {/*
        `POST /community/posts/:id/report` and the admin console's moderation
        queue have both existed since the community module shipped, and nothing
        in the app ever called the route -- so a donor who saw something wrong
        on the feed had no way to say so, and the queue could only ever be
        empty. The reasons are the ones the server's own DTO accepts.
      */}
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
        <Stack gap="md">
          <Stack gap="sm">
            {REPORT_REASONS.map((reason) => (
              <Choice
                key={reason}
                label={t(`community.reportReasons.${reason}`)}
                selected={reportReason === reason}
                onPress={() => setReportReason(reason)}
              />
            ))}
          </Stack>
          <Button
            label={t('community.report')}
            accent="critical"
            disabled={reportReason === null}
            onPress={submitReport}
          />
        </Stack>
      </BottomSheet>
    </Screen>
  );
}

function FeedPost({ post, onReport }: { post: CommunityPost; onReport: () => void }) {
  const { t, formatDate } = useTranslation();

  const authorName =
    post.author?.displayName ||
    [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') ||
    'Bloodchain';
  const type = POST_TYPES[post.type] ?? {
    labelKey: post.type,
    icon: Megaphone,
    tone: 'insight' as const,
  };
  const TypeIcon = type.icon;

  const share = () => {
    Share.share({ message: `${post.title}\n\n${post.body}`, title: post.title }).catch(() => {});
  };

  return (
    <Surface>
      <Stack gap="md">
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
            <Text variant="bodyStrong" numberOfLines={1}>
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

        <Stack gap="xs">
          <Text variant="h3">{post.title}</Text>
          <Text variant="body" tone="secondary">
            {post.body}
          </Text>
        </Stack>

        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            style={{ width: '100%', height: 180, borderRadius: radius.sm }}
          />
        ) : null}

        {/* Buttons, not bare text on a card: text with an icon beside it gives
            nothing to aim at and no sign that it is pressable at all. */}
        <Row gap="sm">
          <Button
            label={t('common.share')}
            variant="secondary"
            size="md"
            block={false}
            accessibilityLabel={t('community.a11yShare', { title: post.title })}
            icon={({ size, color }) => <Share2 size={size} color={color} />}
            onPress={share}
          />
          <Button
            label={t('community.report')}
            variant="secondary"
            size="md"
            block={false}
            accessibilityLabel={t('community.a11yReport', { title: post.title })}
            icon={({ size, color }) => <Flag size={size} color={color} />}
            onPress={onReport}
          />
        </Row>
      </Stack>
    </Surface>
  );
}
