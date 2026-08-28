import { router } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Activity, Calendar, Droplet, HeartPulse, ChevronRight, Clock } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Card,
  GlassCard,
  GradientCard,
  Screen,
  SectionHeader,
  StatCard,
} from '../../src/components';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { useProfileCompletion } from '../../src/hooks/useDonors';
import { useNextAppointment } from '../../src/hooks/useAppointments';
import { useDonationStatistics } from '../../src/hooks/useDonations';
import { useAuthStore } from '../../src/stores/auth.store';
import { colors, spacing, radius } from '../../src/theme';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const { data: userProfile } = useUserProfile();
  const { data: donorProfile } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: nextAppointment } = useNextAppointment();
  const { data: donationStats } = useDonationStatistics();

  const completion = completionData?.data;

  const firstName = userProfile?.firstName || user?.firstName || 'there';
  const greeting = getGreeting(firstName);

  const bloodTypeDisplay = donorProfile?.bloodType && donorProfile?.rhFactor
    ? `${donorProfile.bloodType}${donorProfile.rhFactor === 'POSITIVE' ? '+' : '-'}`
    : '—';

  const bloodTypeStatus = donorProfile?.verificationStatus === 'VERIFIED'
    ? 'Verified'
    : donorProfile?.verificationStatus === 'REQUIRES_REVIEW'
    ? 'Under Review'
    : 'Unverified';

  const bloodTypeColor = donorProfile?.verificationStatus === 'VERIFIED'
    ? colors.success
    : donorProfile?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.warning
    : colors.textMuted;

  const needsOnboarding = completion && completion.percentage < 50;

  const handleCompleteProfile = () => {
    if (needsOnboarding) {
      router.push('/(onboarding)/complete-profile');
    }
  };

  return (
    <Screen>
      <AppText muted style={styles.dateLabel}>
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).toUpperCase()}
      </AppText>
      <AppText variant="title" style={styles.greeting}>
        {greeting}
      </AppText>

      {needsOnboarding && (
        <GlassCard style={styles.onboardingPrompt}>
          <AppText variant="heading">Complete Your Profile</AppText>
          <AppText muted style={styles.onboardingText}>
            Your profile is {completion.percentage}% complete. Complete it to access all features.
          </AppText>
          <AppButton onPress={handleCompleteProfile} style={styles.onboardingButton}>
            Complete Profile
          </AppButton>
        </GlassCard>
      )}

      <GradientCard
        colors={['#26191F', '#111A24']}
        style={styles.bloodTypeCard}
      >
        <View style={styles.bloodTypeHeader}>
          <Droplet size={24} color={colors.primary} />
          <AppText variant="heading">BLOOD TYPE</AppText>
        </View>
        <View style={styles.bloodTypeContent}>
          <AppText variant="numeric" style={styles.bloodTypeValue}>
            {bloodTypeDisplay}
          </AppText>
          <View style={[styles.statusBadge, { backgroundColor: bloodTypeColor + '20' }]}>
            <AppText style={[styles.statusText, { color: bloodTypeColor }]}>
              {bloodTypeStatus}
            </AppText>
          </View>
        </View>
        {donorProfile?.city && (
          <AppText muted style={styles.locationText}>
            {donorProfile.city}
            {donorProfile.district ? `, ${donorProfile.district}` : ''}
          </AppText>
        )}
      </GradientCard>

      {nextAppointment && (
        <>
          <SectionHeader>NEXT APPOINTMENT</SectionHeader>
          <TouchableOpacity
            onPress={() => router.push(`/appointment/${nextAppointment.id}`)}
            activeOpacity={0.8}
          >
            <GlassCard style={styles.appointmentCard}>
              <View style={styles.appointmentHeader}>
                <View style={styles.appointmentType}>
                  <Droplet size={18} color={colors.primary} />
                  <AppText style={styles.appointmentTypeText}>
                    {nextAppointment.appointmentType.replace('_', ' ')}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.appointmentStatus,
                    {
                      backgroundColor:
                        nextAppointment.status === 'CONFIRMED'
                          ? colors.success + '20'
                          : colors.warning + '20',
                    },
                  ]}
                >
                  <AppText
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color:
                        nextAppointment.status === 'CONFIRMED'
                          ? colors.success
                          : colors.warning,
                    }}
                  >
                    {nextAppointment.status}
                  </AppText>
                </View>
              </View>
              <View style={styles.appointmentDetails}>
                <View style={styles.appointmentInfo}>
                  <Calendar size={14} color={colors.textMuted} />
                  <AppText muted style={styles.appointmentInfoText}>
                    {new Date(nextAppointment.scheduledStart).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </AppText>
                </View>
                <View style={styles.appointmentInfo}>
                  <Clock size={14} color={colors.textMuted} />
                  <AppText muted style={styles.appointmentInfoText}>
                    {new Date(nextAppointment.scheduledStart).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </AppText>
                </View>
              </View>
              <View style={styles.appointmentFooter}>
                <AppText numberOfLines={1} style={styles.appointmentOrg}>
                  {nextAppointment.organization.name}
                </AppText>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        </>
      )}

      <SectionHeader>YOUR OVERVIEW</SectionHeader>
      <View style={styles.statsRow}>
        <TouchableOpacity
          onPress={() => router.push('/donations')}
          activeOpacity={0.8}
          style={styles.donationStatCard}
        >
          <GlassCard style={styles.statGlassCard}>
            <View style={styles.statIconContainer}>
              <Droplet size={20} color={colors.primary} />
            </View>
            <AppText variant="numeric" style={styles.statValue}>
              {donationStats?.completedCount ?? 0}
            </AppText>
            <AppText muted style={styles.statNote}>
              {donationStats?.totalVolumeMl
                ? `${(donationStats.totalVolumeMl / 1000).toFixed(1)}L donated`
                : 'No donations yet'}
            </AppText>
          </GlassCard>
        </TouchableOpacity>
        <StatCard
          label="Health"
          value="—"
          note="No data yet"
          icon={Activity}
          variant="success"
          style={styles.statCard}
        />
      </View>

      <SectionHeader>PROFILE</SectionHeader>
      <Card>
        <View style={styles.profileStat}>
          <View>
            <AppText variant="heading">Profile Completion</AppText>
            <AppText muted style={styles.completionNote}>
              {completion?.percentage || 0}% complete
            </AppText>
          </View>
          <View style={styles.completionBadge}>
            <AppText variant="heading" style={{ color: colors.primary }}>
              {completion?.percentage || 0}%
            </AppText>
          </View>
        </View>
      </Card>

      <SectionHeader>QUICK ACTIONS</SectionHeader>
      <View style={styles.quickActions}>
        <AppButton
          variant="secondary"
          onPress={() => router.push('/(app)/profile/donor')}
          style={styles.quickAction}
        >
          Edit Donor Profile
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.push('/(app)/profile/edit')}
          style={styles.quickAction}
        >
          Edit Personal Info
        </AppButton>
      </View>

      <SectionHeader>EMERGENCY</SectionHeader>
      <GlassCard style={styles.sosCard}>
        <AppText variant="heading" style={{ color: colors.danger }}>
          SOS Blood Requests
        </AppText>
        <AppText muted style={styles.sosText}>
          View active emergency requests that match your blood type.
        </AppText>
        <AppButton variant="danger" size="small" onPress={() => router.push('/sos')}>
          View SOS Area
        </AppButton>
      </GlassCard>
    </Screen>
  );
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeGreeting: string;

  if (hour < 12) {
    timeGreeting = 'Good morning';
  } else if (hour < 17) {
    timeGreeting = 'Good afternoon';
  } else {
    timeGreeting = 'Good evening';
  }

  return `${timeGreeting}, ${name}`;
}

const styles = StyleSheet.create({
  dateLabel: {
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  greeting: {
    marginBottom: spacing.xl,
  },
  onboardingPrompt: {
    marginBottom: spacing.xl,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  onboardingText: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  onboardingButton: {
    alignSelf: 'flex-start',
  },
  bloodTypeCard: {
    marginBottom: spacing.lg,
  },
  bloodTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bloodTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bloodTypeValue: {
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    marginTop: spacing.sm,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
  },
  profileStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionNote: {
    fontSize: 13,
    marginTop: 2,
  },
  completionBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
  },
  sosCard: {
    borderColor: '#5B3038',
  },
  sosText: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  appointmentCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  appointmentType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  appointmentTypeText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  appointmentStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  appointmentDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  appointmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  appointmentInfoText: {
    fontSize: 13,
  },
  appointmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentOrg: {
    fontSize: 13,
    flex: 1,
    marginRight: spacing.sm,
  },
  donationStatCard: {
    flex: 1,
  },
  statGlassCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statNote: {
    fontSize: 12,
    textAlign: 'center',
  },
});