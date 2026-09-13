import { router } from 'expo-router';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Droplet,
  Droplets,
  Heart,
  Award,
  Layers,
  TestTube,
  Users,
} from 'lucide-react-native';
import {
  AppText,
  BrandMark,
  Card,
  GlassCard,
  GradientCard,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../src/components';
import { LucideIcon } from '../../src/types/icons';
import { useDonationStatistics, useMyDonations } from '../../src/hooks/useDonations';
import { getCampaigns } from '../../src/api/campaigns';
import { getActiveChallenges } from '../../src/api/challenges';
import { BRAND_NAME, BRAND_TAGLINE } from '../../src/brand';
import { layout, radius, spacing, useTheme } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

type AccentKey = 'primary' | 'secondary' | 'warning' | 'ai';

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
 * into its count, so the tile keeps the honest label until the enum gains the
 * value.
 */
const DONATION_TYPES: {
  value: string;
  /** A catalogue key: this map is built before there is a locale. */
  labelKey: string;
  icon: LucideIcon;
  accent: AccentKey;
  intervalDays?: number;
}[] = [
  { value: 'WHOLE_BLOOD', labelKey: 'medical.donationTypes.wholeBlood', icon: Droplet, accent: 'primary', intervalDays: 56 },
  { value: 'PLASMA', labelKey: 'medical.donationTypes.plasma', icon: TestTube, accent: 'secondary', intervalDays: 28 },
  { value: 'PLATELETS', labelKey: 'medical.donationTypes.platelets', icon: Layers, accent: 'warning', intervalDays: 7 },
  { value: 'OTHER', labelKey: 'medical.donationTypes.other', icon: Droplets, accent: 'ai' },
];

/** The figure every blood service quotes, and the screen says so beside it. */
const LIVES_PER_DONATION = 3;

function daysBetween(from: number, to: number): number {
  return Math.ceil((to - from) / 86_400_000);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Donate() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { data: stats } = useDonationStatistics();
  // Enough history to count every donation per type -- at 3, the tiles below
  // were counting the three most recent donations and calling it a total.
  const { data: donationsData } = useMyDonations({ limit: 100 });
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'active-preview'],
    queryFn: () => getCampaigns({ status: 'ACTIVE', limit: 3 }),
  });
  const { data: challenges } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const donationCountByType = (donationsData?.data ?? []).reduce<Record<string, number>>(
    (acc, donation) => {
      if (donation.status !== 'COMPLETED') return acc;
      acc[donation.donationType] = (acc[donation.donationType] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const activeCampaigns = campaignsData?.items ?? [];
  const featuredChallenge = challenges?.[0];

  const nextDate = stats?.nextDonationDate ? new Date(stats.nextDonationDate) : null;
  const daysToEligible = nextDate ? daysBetween(Date.now(), nextDate.getTime()) : 0;
  const isEligible = !nextDate || daysToEligible <= 0;
  const lastDonated = stats?.lastDonationAt ? new Date(stats.lastDonationAt) : null;
  const daysSinceLast = lastDonated ? daysBetween(lastDonated.getTime(), Date.now()) : null;
  const completedCount = stats?.completedCount ?? 0;

  const goToBooking = () => {
    router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_DONATION' } });
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            {t('donate.title')}
          </AppText>
          <AppText muted style={{ fontSize: 14, marginTop: 2 }}>
            {t('donate.subtitle')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={30} />
          <View>
            <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              {BRAND_NAME}
            </AppText>
            <AppText muted style={{ fontSize: 7, fontWeight: '600', letterSpacing: 1.6 }}>
              {BRAND_TAGLINE}
            </AppText>
          </View>
        </View>
      </View>

      {/* Donate's hero is its own two-stop rose-to-mulberry, distinct from
          both the brand hero and Health's. */}
      <GradientCard colors={['#D85360', '#8E2E63']} style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                minHeight: 30,
                justifyContent: 'center',
                borderRadius: radius.pill,
                backgroundColor: isEligible ? 'rgba(255,255,255,0.22)' : colors.warningMuted,
              }}
            >
              <AppText
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  color: isEligible ? '#FFFFFF' : colors.onMuted.warning,
                }}
              >
                {isEligible ? 'ELIGIBLE NOW' : t('donate.notYetEligible')}
              </AppText>
            </View>

            <AppText
              style={{
                fontSize: 26,
                lineHeight: 33,
                fontWeight: '800',
                letterSpacing: -0.8,
                color: '#FFFFFF',
                marginTop: spacing.md,
              }}
            >
              {isEligible ? (
                'You can donate today.'
              ) : (
                <>
                  Your next donation opens in{' '}
                  <AppText style={{ fontSize: 26, lineHeight: 33, fontWeight: '800', color: '#FFC9D2' }}>
                    {daysToEligible} {daysToEligible === 1 ? 'day' : 'days'}
                  </AppText>
                </>
              )}
            </AppText>
          </View>
          <Droplet size={54} color="#FFFFFF" strokeWidth={1.4} />
        </View>

        {(daysSinceLast !== null || nextDate) && (
          <View style={styleRow}>
            {daysSinceLast !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={14} color="rgba(255,255,255,0.7)" />
                <AppText style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)' }}>
                  Last donated {daysSinceLast === 0 ? 'today' : `${daysSinceLast} days ago`}
                </AppText>
              </View>
            )}
            {daysSinceLast !== null && nextDate && (
              <AppText style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>•</AppText>
            )}
            {nextDate && !isEligible && (
              <AppText style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)' }}>
                Estimated eligible date: {formatDate(nextDate)}
              </AppText>
            )}
          </View>
        )}

        {/*
          The reference calls this "View eligibility timeline". There is no
          timeline screen, and there is no point sending someone to one that
          does not exist -- so it goes where the answer actually lives: the
          booking flow when you can donate, your donation history when you
          cannot, since that is where the date it counts from comes from.
        */}
        <Pressable
          onPress={() => (isEligible ? goToBooking() : router.push('/donations'))}
          accessibilityRole="button"
          accessibilityLabel={isEligible ? 'Schedule a donation' : t('donate.viewHistory')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: 54,
            paddingHorizontal: spacing.md,
            marginTop: spacing.md,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <CalendarDays size={19} color="#FFFFFF" />
          <AppText style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            {isEligible ? 'Schedule a donation' : t('donate.viewHistory')}
          </AppText>
          <ChevronRight size={19} color="#FFFFFF" />
        </Pressable>
      </GradientCard>

      <SectionHeader
        action={{ label: t('donate.learnAboutTypes'), onPress: () => router.push('/education') }}
      >
        {t('donate.donationTypes')}
      </SectionHeader>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.cardGap }}>
        {DONATION_TYPES.map((type) => {
          const Icon = type.icon;
          const count = donationCountByType[type.value] ?? 0;
          return (
            <Pressable
              key={type.value}
              onPress={goToBooking}
              accessibilityRole="button"
              accessibilityLabel={`${t(type.labelKey)}. ${
                count ? `${count} donations` : t('donate.notYetDonated')
              }. Book a donation`}
              style={({ pressed }) => ({
                width: `${(100 - 3) / 2}%`,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Card style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Icon size={24} color={colors[type.accent]} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {t(type.labelKey)}
                    </AppText>
                    <AppText muted style={{ fontSize: 12, marginTop: 1 }}>
                      {type.intervalDays ? `Every ${type.intervalDays} days` : t('donate.specialDonations')}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
                {/* The donor's own count for this type, on its own inset strip
                    -- it is a different kind of fact from the label above it. */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 12,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceElevated,
                  }}
                >
                  <BarChart3 size={13} color={colors.textMuted} />
                  <AppText muted style={{ fontSize: 12 }} numberOfLines={1}>
                    {count ? `${count} donation${count === 1 ? '' : 's'}` : t('donate.notYetDonated')}
                  </AppText>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader
        action={{ label: t('donate.viewImpact'), onPress: () => router.push('/(app)/gamification') }}
      >
        {t('donate.journey')}
      </SectionHeader>
      <GlassCard style={{ borderColor: `${colors.ai}44` }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <JourneyStat
            icon={Heart}
            accent={colors.primary}
            value={`${completedCount}`}
            label={t('donate.totalDonations')}
            note={completedCount ? "You're making a difference" : t('donate.firstOneStarts')}
          />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
          <JourneyStat
            icon={Users}
            accent={colors.secondary}
            value={`${completedCount * LIVES_PER_DONATION}`}
            label={t('donate.livesSupported')}
            note={`About ${LIVES_PER_DONATION} lives per donation`}
          />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
          <JourneyStat
            icon={CalendarDays}
            accent={colors.ai}
            value={isEligible ? 'Now' : `${daysToEligible}`}
            label={isEligible ? 'Ready to give' : t('donate.daysToGo')}
            note={
              isEligible
                ? 'You can donate today'
                : `Next eligible date: ${formatDate(nextDate!)}`
            }
          />
        </View>
      </GlassCard>

      {activeCampaigns.length > 0 && (
        <>
          <SectionHeader action={{ label: t('common.viewAll'), onPress: () => router.push('/campaigns') }}>
            {t('donate.activeCampaigns')}
          </SectionHeader>
          {activeCampaigns.map((campaign) => (
            <TouchableOpacity
              key={campaign.id}
              onPress={() => router.push('/campaigns')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Campaign: ${campaign.title}`}
            >
              <GlassCard style={{ marginBottom: layout.cardGap }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radius.md,
                      backgroundColor: colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Droplet size={22} color={colors.onMuted.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                      {campaign.title}
                    </AppText>
                    <AppText muted style={{ fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                      {campaign.description || campaign.organization?.name || 'Ongoing campaign'}
                    </AppText>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      minHeight: 26,
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      backgroundColor: colors.primaryMuted,
                      borderWidth: 1,
                      borderColor: `${colors.onMuted.primary}33`,
                    }}
                  >
                    <AppText style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: colors.onMuted.primary }}>
                      {t('donate.ongoing')}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/*
        Below the reference's crop, and kept: this screen is the only route
        into Challenges. Dropping the section to match a screenshot would
        strand a whole screen with nothing linking to it.
      */}
      {featuredChallenge && (
        <>
          <SectionHeader action={{ label: t('common.viewAll'), onPress: () => router.push('/challenges') }}>
            {t('donate.challenges')}
          </SectionHeader>
          <TouchableOpacity
            onPress={() => router.push('/challenges')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Challenge: ${featuredChallenge.title}`}
          >
            <GlassCard style={{ marginBottom: layout.cardGap }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radius.md,
                    backgroundColor: colors.warningMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={22} color={colors.onMuted.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {featuredChallenge.title}
                  </AppText>
                  <AppText muted style={{ fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                    {featuredChallenge.description}
                  </AppText>
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar
                        progress={
                          Math.min((featuredChallenge.userProgress ?? 0) / featuredChallenge.goal, 1) * 100
                        }
                        color={colors.warning}
                      />
                    </View>
                    <AppText style={{ fontSize: 11, fontWeight: '700', color: colors.onMuted.warning }}>
                      {featuredChallenge.userProgress ?? 0}/{featuredChallenge.goal}
                    </AppText>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        </>
      )}
    </Screen>
  );
}

const styleRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  flexWrap: 'wrap' as const,
  gap: 10,
  marginTop: spacing.md,
};

function JourneyStat({
  icon: Icon,
  accent,
  value,
  label,
  note,
}: {
  icon: LucideIcon;
  accent: string;
  value: string;
  label: string;
  note: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${accent}26`,
          }}
        >
          <Icon size={17} color={accent} />
        </View>
        <AppText style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: colors.text }}>
          {value}
        </AppText>
      </View>
      <AppText style={{ fontSize: 12.5, fontWeight: '600', marginTop: 6, color: colors.text }}>
        {label}
      </AppText>
      <AppText muted style={{ fontSize: 11, lineHeight: 15, marginTop: 2 }}>
        {note}
      </AppText>
    </View>
  );
}
