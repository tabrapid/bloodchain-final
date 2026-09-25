import { router } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarDays,
  ChevronRight,
  Droplet,
  Droplets,
  Heart,
  Layers,
  TestTube,
  Users,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  ErrorState,
  ListGroup,
  ListRow,
  Progress,
  Row,
  ScrollScreen,
  SectionError,
  SectionHeader,
  Skeleton,
  SkeletonRow,
  Stack,
  Stat,
  StatRow,
  Surface,
  Text,
  iconSize,
  space,
  useDesign,
  type AccentName,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useDonationStatistics, useMyDonations } from '../../src/hooks/useDonations';
import { getCampaigns } from '../../src/api/campaigns';
import { getActiveChallenges } from '../../src/api/challenges';
import { useTranslation } from '../../src/i18n';

/**
 * The four donation types the backend's `DonationType` enum supports, each
 * with the interval between donations of that kind.
 *
 * The intervals are standard donation medicine -- 56 days for whole blood, 28
 * for plasma, 7 for platelets -- and are static reference copy, like the
 * marker definitions on Health. `OTHER` has no fixed interval and shows none.
 *
 * The reference's fourth tile is "Double Red", which the enum has no value
 * for. Labelling `OTHER` as Double Red would put every other kind of donation
 * into its count, so the row keeps the honest label until the enum gains the
 * value.
 */
const DONATION_TYPES: {
  value: string;
  /** A catalogue key: this map is built before there is a locale. */
  labelKey: string;
  icon: LucideIcon;
  tone: AccentName;
  intervalDays?: number;
}[] = [
  { value: 'WHOLE_BLOOD', labelKey: 'medical.donationTypes.wholeBlood', icon: Droplet, tone: 'rose', intervalDays: 56 },
  { value: 'PLASMA', labelKey: 'medical.donationTypes.plasma', icon: TestTube, tone: 'clinical', intervalDays: 28 },
  { value: 'PLATELETS', labelKey: 'medical.donationTypes.platelets', icon: Layers, tone: 'warning', intervalDays: 7 },
  { value: 'OTHER', labelKey: 'medical.donationTypes.other', icon: Droplets, tone: 'insight' },
];

/** The figure every blood service quotes, and the screen says so beside it. */
const LIVES_PER_DONATION = 3;

function daysBetween(from: number, to: number): number {
  return Math.ceil((to - from) / 86_400_000);
}

/**
 * Donate, rebuilt for V2.
 *
 * One question brings a donor to this tab: can I give, and if not, when. V1
 * answered it inside a full-bleed rose-to-mulberry gradient with a shouting
 * caps pill, a 26pt sentence, a 54pt droplet and a translucent button -- and
 * answered it in English, in an app that ships in Uzbek and Russian. Eleven
 * separate strings on this screen were literals: 'ELIGIBLE NOW', 'You can
 * donate today.', 'Your next donation opens in N days', 'Last donated N days
 * ago', 'Estimated eligible date', 'Schedule a donation', 'Every N days', 'N
 * donations', "You're making a difference", 'About 3 lives per donation',
 * 'Ready to give'. Every one of them is a catalogue key now, and the two that
 * count things are real plural rules rather than an English -s.
 *
 * The answer is now the first thing on the screen, in words, on a plain
 * surface, with the one action that follows from it directly beneath.
 *
 * The four donation types were a 2x2 grid of fixed-width tiles. "Whole blood"
 * is "Butun qon" in Uzbek and "Цельная кровь" in Russian; a tile cannot grow
 * and a row can, so they are rows.
 *
 * Kept deliberately: the Challenges section, which is the only route into that
 * screen, and the donor's own per-type counts, which are the only place in the
 * app that answers "what have I actually given".
 */
export default function Donate() {
  const { colors } = useDesign();
  const { t, formatDate } = useTranslation();

  const stats = useDonationStatistics();
  // Enough history to count every donation per type -- at 3, the rows below
  // were counting the three most recent donations and calling it a total.
  const donations = useMyDonations({ limit: 100 });
  const campaigns = useQuery({
    queryKey: ['campaigns', 'active-preview'],
    queryFn: () => getCampaigns({ status: 'ACTIVE', limit: 3 }),
  });
  const challenges = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const refreshing = stats.isRefetching || donations.isRefetching;
  const onRefresh = () => {
    void stats.refetch();
    void donations.refetch();
    void campaigns.refetch();
    void challenges.refetch();
  };

  const header = (
    <View style={{ paddingTop: space.md, gap: 2 }}>
      <Text variant="h1">{t('donate.title')}</Text>
      <Text variant="body" tone="secondary">
        {t('donate.subtitle')}
      </Text>
    </View>
  );

  if (stats.isPending) {
    return (
      <ScrollScreen>
        <Stack gap="xl">
          {header}
          <Surface>
            <Stack gap="md">
              <Skeleton width="40%" height={12} />
              <Skeleton width="75%" height={28} />
              <Skeleton height={52} corner="sm" />
            </Stack>
          </Surface>
          <Surface>
            <SkeletonRow />
            <SkeletonRow />
          </Surface>
        </Stack>
      </ScrollScreen>
    );
  }

  if (stats.isError) {
    return (
      <ScrollScreen>
        <Stack gap="xl">
          {header}
          <ErrorState
            title={t('common.errorTitle')}
            description={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void stats.refetch()}
          />
        </Stack>
      </ScrollScreen>
    );
  }

  const donationCountByType = (donations.data?.data ?? []).reduce<Record<string, number>>(
    (acc, donation) => {
      if (donation.status !== 'COMPLETED') return acc;
      acc[donation.donationType] = (acc[donation.donationType] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const activeCampaigns = campaigns.data?.items ?? [];
  const featuredChallenge = challenges.data?.[0];

  const nextDate = stats.data?.nextDonationDate ? new Date(stats.data.nextDonationDate) : null;
  const daysToEligible = nextDate ? daysBetween(Date.now(), nextDate.getTime()) : 0;
  const isEligible = !nextDate || daysToEligible <= 0;
  const lastDonated = stats.data?.lastDonationAt ? new Date(stats.data.lastDonationAt) : null;
  const daysSinceLast = lastDonated ? daysBetween(lastDonated.getTime(), Date.now()) : null;
  const completedCount = stats.data?.completedCount ?? 0;

  const goToBooking = () => {
    router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_DONATION' } });
  };

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack gap="xl">
        {header}

        {/* ------------------------------------------- can I give, and when */}
        <Surface>
          <Stack gap="lg">
            <Row gap="md" align="flex-start">
              <View style={{ flex: 1, gap: space.sm }}>
                <Badge
                  label={isEligible ? t('donate.eligibleNow') : t('donate.notEligible')}
                  tone={isEligible ? 'success' : 'warning'}
                />
                <Text variant="h2">
                  {isEligible
                    ? t('donate.canDonateToday')
                    : t('donate.opensInDays', { count: daysToEligible })}
                </Text>
                {/* The evidence for the sentence above it, never on its own:
                    a date with no claim attached is just a date. */}
                {daysSinceLast !== null || (nextDate && !isEligible) ? (
                  <Text variant="caption" tone="tertiary">
                    {[
                      daysSinceLast === null
                        ? null
                        : daysSinceLast <= 0
                          ? t('donate.lastDonatedToday')
                          : t('donate.lastDonatedOn', { date: formatDate(lastDonated!, 'medium') }),
                      nextDate && !isEligible
                        ? t('donate.nextEligibleOn', { date: formatDate(nextDate, 'medium') })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Droplet size={iconSize.xl} color={colors.rose.base} strokeWidth={1.5} />
            </Row>

            {/*
              The reference calls this "View eligibility timeline". There is no
              timeline screen, and there is no point sending someone to one
              that does not exist -- so it goes where the answer actually
              lives: the booking flow when you can donate, your donation
              history when you cannot, since that is where the date it counts
              from comes from.
            */}
            {isEligible ? (
              <Button
                label={t('donate.schedule')}
                icon={({ size, color }) => <CalendarDays size={size} color={color} />}
                onPress={goToBooking}
              />
            ) : (
              <Button
                label={t('donate.viewHistory')}
                variant="secondary"
                icon={({ size, color }) => <CalendarDays size={size} color={color} />}
                onPress={() => router.push('/donations')}
              />
            )}
          </Stack>
        </Surface>

        {/* -------------------------------------------------- what you give */}
        <Stack gap="md">
          <SectionHeader
            title={t('donate.donationTypes')}
            action={
              <Button
                label={t('donate.learnAboutTypes')}
                variant="ghost"
                size="md"
                block={false}
                onPress={() => router.push('/education')}
              />
            }
          />
          <ListGroup
            rows={DONATION_TYPES.map((type) => {
              const Icon = type.icon;
              const count = donationCountByType[type.value] ?? 0;
              return (
                <ListRow
                  key={type.value}
                  leading={<Icon size={iconSize.lg} color={colors[type.tone].base} />}
                  title={t(type.labelKey)}
                  subtitle={
                    type.intervalDays
                      ? t('donate.everyDays', { count: type.intervalDays })
                      : t('donate.specialDonations')
                  }
                  value={count ? t('units.donations', { count }) : t('donate.notYetDonated')}
                  accessibilityLabel={`${t(type.labelKey)}. ${
                    count ? t('units.donations', { count }) : t('donate.notYetDonated')
                  }. ${t('donate.bookDonation')}`}
                  onPress={goToBooking}
                />
              );
            })}
          />
        </Stack>

        {/* ------------------------------------------------- what it added up to */}
        <Stack gap="md">
          <SectionHeader
            title={t('donate.journey')}
            action={
              <Button
                label={t('donate.viewImpact')}
                variant="ghost"
                size="md"
                block={false}
                onPress={() => router.push('/(app)/gamification')}
              />
            }
          />
          <StatRow>
            <Stat
              label={t('donate.totalDonations')}
              value={String(completedCount)}
              icon={({ size, color }) => <Heart size={size} color={color} />}
              tone="rose"
            />
            <Stat
              label={t('donate.livesSupported')}
              value={String(completedCount * LIVES_PER_DONATION)}
              icon={({ size, color }) => <Users size={size} color={color} />}
              tone="clinical"
            />
            <Stat
              label={isEligible ? t('donate.readyToGive') : t('donate.daysToGo')}
              value={isEligible ? t('donate.now') : String(daysToEligible)}
              icon={({ size, color }) => <CalendarDays size={size} color={color} />}
              tone="insight"
            />
          </StatRow>
          {/* The multiplier is stated, not implied. "Lives supported" is an
              estimate the blood service quotes, and a donor is entitled to
              know it is arithmetic rather than a count of people. */}
          <Text variant="caption" tone="tertiary">
            {completedCount
              ? t('donate.livesPerDonation', { count: LIVES_PER_DONATION })
              : t('donate.firstOneStarts')}
          </Text>
        </Stack>

        {/* --------------------------------------------------- campaigns */}
        {campaigns.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void campaigns.refetch()}
          />
        ) : activeCampaigns.length > 0 ? (
          <Stack gap="md">
            <SectionHeader
              title={t('donate.activeCampaigns')}
              action={
                <Button
                  label={t('common.viewAll')}
                  variant="ghost"
                  size="md"
                  block={false}
                  onPress={() => router.push('/campaigns')}
                />
              }
            />
            <ListGroup
              rows={activeCampaigns.map((campaign) => (
                <ListRow
                  key={campaign.id}
                  leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
                  title={campaign.title}
                  subtitle={
                    campaign.description || campaign.organization?.name || t('donate.ongoingCampaign')
                  }
                  trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                  onPress={() => router.push('/campaigns')}
                />
              ))}
            />
          </Stack>
        ) : null}

        {/*
          Below the reference's crop, and kept: this screen is the only route
          into Challenges. Dropping the section to match a screenshot would
          strand a whole screen with nothing linking to it.
        */}
        {featuredChallenge ? (
          <Stack gap="md">
            <SectionHeader
              title={t('donate.challenges')}
              action={
                <Button
                  label={t('common.viewAll')}
                  variant="ghost"
                  size="md"
                  block={false}
                  onPress={() => router.push('/challenges')}
                />
              }
            />
            <Surface onPress={() => router.push('/challenges')} accessibilityLabel={featuredChallenge.title}>
              <Stack gap="md">
                <Row gap="md" align="flex-start">
                  <Award size={iconSize.lg} color={colors.warning.base} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {featuredChallenge.title}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {featuredChallenge.description}
                    </Text>
                  </View>
                  <ChevronRight size={iconSize.md} color={colors.textTertiary} />
                </Row>
                <Progress
                  label={featuredChallenge.title}
                  caption={t('donate.progressOf', {
                    done: featuredChallenge.userProgress ?? 0,
                    goal: featuredChallenge.goal,
                  })}
                  value={(featuredChallenge.userProgress ?? 0) / (featuredChallenge.goal || 1)}
                  tone="warning"
                />
              </Stack>
            </Surface>
          </Stack>
        ) : null}

        {donations.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void donations.refetch()}
          />
        ) : null}
      </Stack>
    </ScrollScreen>
  );
}
