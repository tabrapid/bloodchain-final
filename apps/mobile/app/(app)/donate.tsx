import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Award, ChevronRight, Clock, Droplet, HeartHandshake, History, MapPin } from 'lucide-react-native';
import { AppButton, AppText, Badge, Card, GlassCard, GradientCard, ProgressBar, Screen, SectionHeader } from '../../src/components';
import { useDonationStatistics, useMyDonations } from '../../src/hooks/useDonations';
import { getCampaigns } from '../../src/api/campaigns';
import { getActiveChallenges } from '../../src/api/challenges';
import { getCommunityStats } from '../../src/api/community';
import { spacing, useTheme } from '../../src/theme';

export default function Donate() {
  const { colors } = useTheme();
  const { data: stats } = useDonationStatistics();
  const { data: donationsData } = useMyDonations({ limit: 3 });
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'active-preview'],
    queryFn: () => getCampaigns({ status: 'ACTIVE', limit: 3 }),
  });
  const { data: challenges } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });
  const { data: communityStats } = useQuery({
    queryKey: ['community', 'stats'],
    queryFn: getCommunityStats,
  });

  const recentDonations = donationsData?.data ?? [];
  const activeCampaigns = campaignsData?.items ?? [];
  const featuredChallenge = challenges?.[0];

  const isEligible = !stats?.nextDonationDate || new Date(stats.nextDonationDate) <= new Date();

  const goToBooking = () => {
    router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_DONATION' } });
  };

  return (
    <Screen>
      <AppText variant="title">Donate</AppText>
      <AppText muted style={{ marginTop: spacing.sm }}>
        Make an impact, on your terms.
      </AppText>

      <GradientCard colors={colors.heroGradient} style={{ marginTop: spacing.xl }}>
        <Droplet
          size={120}
          color="rgba(255,255,255,0.10)"
          fill="rgba(255,255,255,0.06)"
          style={{ position: 'absolute', top: -18, right: -18 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Badge variant={isEligible ? 'success' : 'warning'} style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
              {isEligible ? 'Eligible to donate' : 'Not yet eligible'}
            </Badge>
            <AppText style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 26 }}>
              Ready for your{'\n'}next donation?
            </AppText>
            {stats?.lastDonationAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
                <Clock size={11} color="rgba(255,255,255,0.65)" />
                <AppText style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  Last donated {Math.floor((Date.now() - new Date(stats.lastDonationAt).getTime()) / 86400000)} days ago
                </AppText>
              </View>
            ) : (
              !isEligible && (
                <AppText style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: spacing.sm }}>
                  Eligible from {new Date(stats!.nextDonationDate!).toLocaleDateString()}
                </AppText>
              )
            )}
          </View>
          <Droplet size={36} color="#FFFFFF" fill="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        </View>
        <AppButton
          onPress={goToBooking}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
        >
          Schedule a Donation
        </AppButton>
      </GradientCard>

      <SectionHeader>YOUR JOURNEY</SectionHeader>
      <TouchableOpacity onPress={() => router.push('/donations')} activeOpacity={0.8}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <History size={22} color={colors.secondary} />
            <AppText variant="heading" style={{ flex: 1 }}>
              Donation history
            </AppText>
            <ChevronRight size={20} color={colors.textMuted} />
          </View>
          {recentDonations.length > 0 ? (
            <AppText muted>
              {stats?.completedCount ?? recentDonations.length} donation
              {(stats?.completedCount ?? recentDonations.length) !== 1 ? 's' : ''} · last on{' '}
              {new Date(recentDonations[0]!.createdAt).toLocaleDateString()}
            </AppText>
          ) : (
            <AppText muted>No donations yet. Your history will appear here.</AppText>
          )}
        </Card>
      </TouchableOpacity>

      {activeCampaigns.length > 0 && (
        <>
          <SectionHeader action={{ label: 'See all', onPress: () => router.push('/campaigns') }}>
            ACTIVE CAMPAIGNS
          </SectionHeader>
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            {activeCampaigns.map((campaign) => (
              <TouchableOpacity
                key={campaign.id}
                onPress={() => router.push('/campaigns')}
                activeOpacity={0.8}
              >
                <GlassCard style={{ padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                        <AppText style={{ fontSize: 13, fontWeight: '600' }}>
                          {campaign.organization?.name ?? campaign.title}
                        </AppText>
                        {campaign.bloodGroupsNeeded.length > 0 && (
                          <Badge variant="danger">{campaign.bloodGroupsNeeded.join(', ')}</Badge>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} color={colors.textMuted} />
                          <AppText muted style={{ fontSize: 11 }}>
                            Until {new Date(campaign.endDate).toLocaleDateString()}
                          </AppText>
                        </View>
                        {campaign.location && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <MapPin size={10} color={colors.textMuted} />
                            <AppText muted style={{ fontSize: 11 }}>
                              {campaign.location}
                            </AppText>
                          </View>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {featuredChallenge && (
        <>
          <SectionHeader action={{ label: 'View all', onPress: () => router.push('/challenges') }}>
            CHALLENGES
          </SectionHeader>
          <TouchableOpacity onPress={() => router.push('/challenges')} activeOpacity={0.8}>
            <GlassCard style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.warningMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={22} color={colors.onMuted.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 13, fontWeight: '600' }}>{featuredChallenge.title}</AppText>
                  <AppText muted style={{ fontSize: 12 }}>
                    {featuredChallenge.description}
                  </AppText>
                  <View style={{ marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar
                        progress={Math.min((featuredChallenge.userProgress ?? 0) / featuredChallenge.goal, 1) * 100}
                        color={colors.warning}
                      />
                    </View>
                    <AppText style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>
                      {featuredChallenge.userProgress ?? 0}/{featuredChallenge.goal}
                    </AppText>
                  </View>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </>
      )}

      {communityStats && (
        <>
          <SectionHeader>COMMUNITY IMPACT</SectionHeader>
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <AppText variant="heading" style={{ fontSize: 22 }}>
                  {communityStats.participants}
                </AppText>
                <AppText muted style={{ fontSize: 11 }}>
                  Donors participating
                </AppText>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <AppText variant="heading" style={{ fontSize: 22 }}>
                  {communityStats.activeCampaigns}
                </AppText>
                <AppText muted style={{ fontSize: 11 }}>
                  Active campaigns
                </AppText>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <AppText variant="heading" style={{ fontSize: 22 }}>
                  {communityStats.activeChallenges}
                </AppText>
                <AppText muted style={{ fontSize: 11 }}>
                  Active challenges
                </AppText>
              </View>
            </View>
          </GlassCard>
        </>
      )}

      <SectionHeader>EMERGENCY REQUESTS</SectionHeader>
      <TouchableOpacity onPress={() => router.push('/sos')} activeOpacity={0.8}>
        <Card style={{ borderColor: colors.danger }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <HeartHandshake size={22} color={colors.danger} />
            <AppText variant="heading" style={{ color: colors.danger, flex: 1 }}>
              Respond to SOS
            </AppText>
            <ChevronRight size={20} color={colors.textMuted} />
          </View>
          <AppText muted>
            View active emergency blood requests that match your blood type nearby.
          </AppText>
        </Card>
      </TouchableOpacity>
    </Screen>
  );
}
