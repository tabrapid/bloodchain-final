import { router } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Droplet,
  Droplets,
  Heart,
  History,
  Layers,
  Siren,
  TestTube,
  Users,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  ErrorState,
  LinkButton,
  ListGroup,
  ListRow,
  Progress,
  Row,
  ScreenTitle,
  ScrollScreen,
  Section,
  SectionError,
  Sections,
  Skeleton,
  SkeletonRow,
  Stat,
  StatRow,
  Surface,
  Text,
  ValueText,
  iconSize,
  radius,
  space,
  useDesign,
  type AccentName,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useDonationStatistics, useMyDonations } from '../../src/hooks/useDonations';
import { useDonorEmergencies } from '../../src/hooks/useEmergency';
import { getCampaigns } from '../../src/api/campaigns';
import { getActiveChallenges } from '../../src/api/challenges';
import { useTranslation } from '../../src/i18n';

/**
 * The four donation types the backend's `DonationType` enum supports, each
 * with the interval between donations of that kind.
 *
 * The intervals are standard donation medicine -- 56 days for whole blood, 28
 * for plasma, 7 for platelets -- and are static reference copy. `OTHER` has
 * no fixed interval and shows none.
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
  { value: 'PLATELETS', labelKey: 'medical.donationTypes.platelets', icon: Layers, tone: 'clinical', intervalDays: 7 },
  { value: 'OTHER', labelKey: 'medical.donationTypes.other', icon: Droplets, tone: 'clinical' },
];

/** The figure every blood service quotes, and the screen says so beside it. */
const LIVES_PER_DONATION = 3;

function daysBetween(from: number, to: number): number {
  return Math.ceil((to - from) / 86_400_000);
}

/**
 * Donate, composed for V4: action-oriented.
 *
 * One question brings a donor to this tab: can I give, and if not, when. The
 * answer is the first thing on the screen, as a sentence on a surface tinted
 * by the answer, with the one action that follows from it directly beneath.
 * Below that: the emergency requests near them, a record of what they have
 * given, the numbers it adds up to, and the campaigns and challenges that
 * are asking for donors.
 */
export default function Donate() {
  const { colors } = useDesign();
  const { t, formatDate } = useTranslation();

  const stats = useDonationStatistics();
  // Enough history to count every donation per type.
  const donations = useMyDonations({ limit: 100 });
  const emergencies = useDonorEmergencies();
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
    void emergencies.refetch();
  };

  const header = <ScreenTitle title={t('donate.title')} subtitle={t('donate.subtitle')} />;

  if (stats.isPending) {
    return (
      <ScrollScreen>
        <Sections>
          {header}
          <Surface>
            <View style={{ gap: space.md }}>
              <Skeleton width="30%" height={22} corner="full" />
              <Skeleton width="75%" height={28} />
              <Skeleton width="55%" height={12} />
              <Skeleton height={52} corner="md" style={{ marginTop: space.sm }} />
            </View>
          </Surface>
          <Surface level="flat">
            <SkeletonRow />
            <SkeletonRow />
          </Surface>
        </Sections>
      </ScrollScreen>
    );
  }

  if (stats.isError) {
    return (
      <ScrollScreen>
        <Sections>
          {header}
          <ErrorState
            title={t('common.errorTitle')}
            description={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void stats.refetch()}
          />
        </Sections>
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
  const activeEmergencyCount = emergencies.data?.active.length ?? 0;

  const nextDate = stats.data?.nextDonationDate ? new Date(stats.data.nextDonationDate) : null;
  const daysToEligible = nextDate ? daysBetween(Date.now(), nextDate.getTime()) : 0;
  const isEligible = !nextDate || daysToEligible <= 0;
  const lastDonated = stats.data?.lastDonationAt ? new Date(stats.data.lastDonationAt) : null;
  const daysSinceLast = lastDonated ? daysBetween(lastDonated.getTime(), Date.now()) : null;
  const completedCount = stats.data?.completedCount ?? 0;

  const goToBooking = () => {
    router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_DONATION' } });
  };

  const evidence = [
    daysSinceLast === null
      ? null
      : daysSinceLast <= 0
        ? t('donate.lastDonatedToday')
        : t('donate.lastDonatedOn', { date: formatDate(lastDonated!, 'medium') }),
    nextDate && !isEligible ? t('donate.nextEligibleOn', { date: formatDate(nextDate, 'medium') }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Sections rhythm="major">
        {header}

        {/* ------------------------------------------- can I give, and when */}
        <Surface tone={isEligible ? 'success' : undefined} corner="xl">
          <View style={{ gap: space.lg }}>
            <Row gap="lg" align="flex-start">
              <View style={{ flex: 1, gap: space.sm }}>
                <Badge
                  label={isEligible ? t('donate.eligibleNow') : t('donate.notEligible')}
                  tone={isEligible ? 'success' : 'warning'}
                  dot
                />
                <Text variant="h2">
                  {isEligible
                    ? t('donate.canDonateToday')
                    : t('donate.opensInDays', { count: daysToEligible })}
                </Text>
                {evidence ? (
                  <Text variant="caption" tone="secondary">
                    {evidence}
                  </Text>
                ) : null}
              </View>
              {!isEligible ? (
                <View style={{ alignItems: 'center', gap: 2, minWidth: 64 }}>
                  <ValueText style={{ color: colors.textPrimary }}>{String(daysToEligible)}</ValueText>
                  <Text variant="overline" tone="tertiary" caps>
                    {t('donate.daysLabel')}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.success.soft,
                  }}
                >
                  <Droplet size={iconSize.lg} color={colors.success.base} />
                </View>
              )}
            </Row>

            {isEligible ? (
              <Button
                label={t('donate.schedule')}
                icon={({ size, color }) => <CalendarPlus size={size} color={color} />}
                onPress={goToBooking}
              />
            ) : (
              <Button
                label={t('donate.viewHistory')}
                variant="secondary"
                icon={({ size, color }) => <History size={size} color={color} />}
                onPress={() => router.push('/donations')}
              />
            )}
          </View>
        </Surface>

        {/* ------------------------------------------------ emergency area */}
        <ListGroup
          rows={[
            <ListRow
              key="sos"
              icon={({ size, color }) => <Siren size={size} color={color} />}
              iconTone={activeEmergencyCount > 0 ? 'critical' : undefined}
              title={t('home.emergencyRequests')}
              subtitle={
                activeEmergencyCount > 0
                  ? t('home.emergenciesMatched', { count: activeEmergencyCount })
                  : t('home.noEmergencies')
              }
              subtitleTrailing={
                activeEmergencyCount > 0 ? (
                  <Badge label={String(activeEmergencyCount)} tone="critical" emphasis="solid" />
                ) : undefined
              }
              onPress={() => router.push('/sos')}
            />,
            <ListRow
              key="history"
              icon={({ size, color }) => <History size={size} color={color} />}
              title={t('donate.viewHistory')}
              value={completedCount ? t('units.donations', { count: completedCount }) : undefined}
              onPress={() => router.push('/donations')}
            />,
          ]}
        />

        {/* ------------------------------------------------ what you give */}
        <Section
          title={t('donate.donationTypes')}
          action={
            <LinkButton label={t('donate.learnAboutTypes')} onPress={() => router.push('/education')} />
          }
        >
          <ListGroup
            rows={DONATION_TYPES.map((type) => {
              const Icon = type.icon;
              const count = donationCountByType[type.value] ?? 0;
              return (
                <ListRow
                  key={type.value}
                  icon={({ size, color }) => <Icon size={size} color={color} />}
                  iconTone={count ? type.tone : undefined}
                  title={t(type.labelKey)}
                  subtitle={
                    type.intervalDays
                      ? t('donate.everyDays', { count: type.intervalDays })
                      : t('donate.specialDonations')
                  }
                  value={count ? t('units.donations', { count }) : t('donate.notYetDonated')}
                  valueTone={count ? 'rose' : undefined}
                  accessibilityLabel={`${t(type.labelKey)}. ${
                    count ? t('units.donations', { count }) : t('donate.notYetDonated')
                  }`}
                />
              );
            })}
          />
        </Section>

        {/* ------------------------------------------------- what it added up to */}
        <Section
          title={t('donate.journey')}
          action={
            <LinkButton
              label={t('donate.viewImpact')}
              onPress={() => router.push('/(app)/gamification')}
              icon={({ size, color }) => <ChevronRight size={size} color={color} />}
            />
          }
        >
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
              {...(isEligible ? { tone: 'success' as const } : {})}
            />
          </StatRow>
          {/* The multiplier is stated, not implied. */}
          <Text variant="caption" tone="tertiary">
            {completedCount
              ? t('donate.livesPerDonation', { count: LIVES_PER_DONATION })
              : t('donate.firstOneStarts')}
          </Text>
        </Section>

        {/* --------------------------------------------------- campaigns */}
        {campaigns.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void campaigns.refetch()}
          />
        ) : activeCampaigns.length > 0 ? (
          <Section
            title={t('donate.activeCampaigns')}
            action={<LinkButton label={t('common.viewAll')} onPress={() => router.push('/campaigns')} />}
          >
            <ListGroup
              rows={activeCampaigns.map((campaign) => (
                <ListRow
                  key={campaign.id}
                  icon={({ size, color }) => <Droplet size={size} color={color} />}
                  iconTone="rose"
                  title={campaign.title}
                  subtitle={
                    campaign.description || campaign.organization?.name || t('donate.ongoingCampaign')
                  }
                  onPress={() => router.push('/campaigns')}
                />
              ))}
            />
          </Section>
        ) : null}

        {/* This screen is the only route into Challenges. */}
        {featuredChallenge ? (
          <Section
            title={t('donate.challenges')}
            action={<LinkButton label={t('common.viewAll')} onPress={() => router.push('/challenges')} />}
          >
            <Surface onPress={() => router.push('/challenges')} accessibilityLabel={featuredChallenge.title}>
              <View style={{ gap: space.md }}>
                <Row gap="md" align="flex-start">
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceRaised,
                    }}
                  >
                    <Award size={iconSize.md} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title" numberOfLines={1}>
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
                  thickness="thin"
                />
              </View>
            </Surface>
          </Section>
        ) : null}

        {donations.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void donations.refetch()}
          />
        ) : null}
      </Sections>
    </ScrollScreen>
  );
}
