import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { CalendarPlus, ChevronRight, HeartHandshake, History } from 'lucide-react-native';
import { AppButton, AppText, Card, Screen, SectionHeader } from '../../src/components';
import { useDonationStatistics, useMyDonations } from '../../src/hooks/useDonations';
import { colors, spacing } from '../../src/theme';

export default function Donate() {
  const { data: stats } = useDonationStatistics();
  const { data: donationsData } = useMyDonations({ limit: 3 });

  const recentDonations = donationsData?.data ?? [];

  const goToBooking = () => {
    router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_DONATION' } });
  };

  return (
    <Screen>
      <AppText variant="title">Donate</AppText>
      <AppText muted style={{ marginTop: spacing.sm }}>
        Make an impact, on your terms.
      </AppText>

      <Card style={{ marginTop: spacing.xl, borderColor: '#5B3038' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#26191F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarPlus size={22} color={colors.primary} />
          </View>
          <AppText variant="heading">Book a donation</AppText>
        </View>
        <AppText muted style={{ marginBottom: spacing.md }}>
          {stats?.nextDonationDate
            ? `You're eligible to donate again from ${new Date(stats.nextDonationDate).toLocaleDateString()}.`
            : 'Choose a hospital or blood center and pick a time that works for you.'}
        </AppText>
        <AppButton size="small" onPress={goToBooking}>
          Book now
        </AppButton>
      </Card>

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

      <SectionHeader>EMERGENCY REQUESTS</SectionHeader>
      <TouchableOpacity onPress={() => router.push('/sos')} activeOpacity={0.8}>
        <Card style={{ borderColor: '#5B3038' }}>
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
