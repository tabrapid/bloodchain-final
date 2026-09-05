import { useMemo } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Bell,
  Calendar,
  Droplet,
  MapPin,
  Shield,
  TrendingUp,
  Zap,
  ChevronRight,
  Clock,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Avatar,
  Card,
  GlassCard,
  GradientCard,
  IconButton,
  OverviewStat,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../src/components';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { useProfileCompletion } from '../../src/hooks/useDonors';
import { useNextAppointment } from '../../src/hooks/useAppointments';
import { useDonationStatistics } from '../../src/hooks/useDonations';
import { useGamificationProfile } from '../../src/hooks/useGamification';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useDonorEmergencies } from '../../src/hooks/useEmergency';
import { useAuthStore } from '../../src/stores/auth.store';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';

export default function Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { data: userProfile } = useUserProfile();
  const { data: donorProfile } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: nextAppointment } = useNextAppointment();
  const { data: donationStats } = useDonationStatistics();
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: unreadCount } = useUnreadCount();
  const { data: emergencies } = useDonorEmergencies();

  const fullName = userProfile ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') : undefined;
  const activeEmergencyCount = emergencies?.active.length ?? 0;

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
    ? colors.successMuted
    : donorProfile?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.warningMuted
    : colors.surfaceElevated;
  const bloodTypeTextColor = donorProfile?.verificationStatus === 'VERIFIED'
    ? colors.onMuted.success
    : donorProfile?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.onMuted.warning
    : colors.textMuted;

  const needsOnboarding = completion && completion.percentage < 50;

  const handleCompleteProfile = () => {
    if (needsOnboarding) {
      router.push('/(onboarding)/complete-profile');
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText muted style={styles.dateLabel}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </AppText>
          <AppText style={styles.greeting}>{greeting}</AppText>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon={Bell}
            onPress={() => router.push('/(app)/notifications')}
            badge={unreadCount?.count}
          />
          <TouchableOpacity onPress={() => router.push('/(app)/profile')}>
            <Avatar name={fullName ?? user?.firstName ?? 'Donor'} size={40} />
          </TouchableOpacity>
        </View>
      </View>

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
        colors={colors.heroGradient}
        style={styles.bloodTypeCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroTopLeft}>
            <View style={styles.bloodTypeHeader}>
              <Droplet size={14} color="rgba(255,255,255,0.7)" fill="rgba(255,255,255,0.5)" />
              <AppText style={styles.bloodTypeLabel}>BLOOD TYPE</AppText>
            </View>
            <AppText style={styles.bloodTypeValue}>{bloodTypeDisplay}</AppText>
            <View style={styles.bloodTypeContent}>
              <View style={[styles.statusBadge, { backgroundColor: bloodTypeColor }]}>
                <AppText style={[styles.statusText, { color: bloodTypeTextColor }]}>
                  {bloodTypeStatus}
                </AppText>
              </View>
              {donorProfile?.city && (
                <View style={styles.locationRow}>
                  <MapPin size={11} color="rgba(255,255,255,0.65)" />
                  <AppText style={styles.locationText}>
                    {donorProfile.city}
                    {donorProfile.district ? `, ${donorProfile.district}` : ''}
                  </AppText>
                </View>
              )}
            </View>
          </View>
          <View style={styles.heroShield}>
            <Shield size={28} color="#FFFFFF" strokeWidth={1.5} />
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <AppText style={styles.heroStatValue}>{donationStats?.completedCount ?? 0}</AppText>
            <AppText style={styles.heroStatLabel}>Donations</AppText>
          </View>
          <View style={styles.heroStatItem}>
            <View style={styles.heroStatValueRow}>
              <AppText style={styles.heroStatValue}>
                {donationStats?.totalVolumeMl ? (donationStats.totalVolumeMl / 1000).toFixed(1) : '0'}
              </AppText>
              <AppText style={styles.heroStatUnit}>L</AppText>
            </View>
            <AppText style={styles.heroStatLabel}>Total volume</AppText>
          </View>
          <View style={styles.heroStatItem}>
            <AppText style={styles.heroStatValue}>{gamificationProfile?.emergencyResponseCount ?? 0}</AppText>
            <AppText style={styles.heroStatLabel}>Emergency responses</AppText>
          </View>
        </View>
      </GradientCard>

      {nextAppointment && (
        <>
          <SectionHeader>NEXT APPOINTMENT</SectionHeader>
          <TouchableOpacity
            onPress={() => router.push(`/appointment/${nextAppointment.id}`)}
            activeOpacity={0.8}
          >
            <GlassCard tier="elevated" style={styles.appointmentCard}>
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
                          ? colors.successMuted
                          : colors.warningMuted,
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
                          ? colors.onMuted.success
                          : colors.onMuted.warning,
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
        <OverviewStat
          icon={Droplet}
          color="primary"
          value={donationStats?.completedCount ?? 0}
          label="Donations"
          onPress={() => router.push('/donations')}
          style={styles.donationStatCard}
        />
        <OverviewStat
          icon={TrendingUp}
          color="secondary"
          value={donationStats?.totalVolumeMl ? (donationStats.totalVolumeMl / 1000).toFixed(1) : '0'}
          unit="L"
          label="Total volume"
          style={styles.donationStatCard}
        />
        <OverviewStat
          icon={Zap}
          color="warning"
          value={gamificationProfile?.totalXp ?? 0}
          label="XP points"
          onPress={() => router.push('/(app)/gamification')}
          style={styles.donationStatCard}
        />
      </View>

      <SectionHeader>PROFILE</SectionHeader>
      <Card>
        <View style={styles.profileStat}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.completionTitle}>Complete your profile</AppText>
            <AppText muted style={styles.completionNote}>
              Add medical info to unlock all features
            </AppText>
          </View>
          <View style={styles.completionBadge}>
            <AppText style={styles.completionBadgeText}>{completion?.percentage || 0}%</AppText>
          </View>
        </View>
        <ProgressBar progress={completion?.percentage || 0} color={colors.success} />
      </Card>

      <SectionHeader>QUICK ACTIONS</SectionHeader>
      <View style={styles.quickActions}>
        <AppButton
          variant="secondary"
          size="small"
          onPress={() => router.push('/(app)/profile/donor')}
          style={styles.quickAction}
        >
          Edit Donor Profile
        </AppButton>
        <AppButton
          variant="secondary"
          size="small"
          onPress={() => router.push('/(app)/profile/edit')}
          style={styles.quickAction}
        >
          Edit Personal Info
        </AppButton>
      </View>

      <SectionHeader>EMERGENCY</SectionHeader>
      <GlassCard tier="danger" style={styles.sosCard}>
        <View style={styles.sosRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.sosHeader}>
              {activeEmergencyCount > 0 && <View style={styles.sosPulseDot} />}
              <AppText style={styles.sosTitle}>Emergency Requests</AppText>
            </View>
            <AppText muted style={styles.sosText}>
              {activeEmergencyCount > 0
                ? `${activeEmergencyCount} urgent ${activeEmergencyCount === 1 ? 'request' : 'requests'} near you`
                : 'No active emergency requests right now'}
            </AppText>
          </View>
          <AppButton variant="danger" size="small" onPress={() => router.push('/sos')}>
            SOS Area
          </AppButton>
        </View>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    headerText: {
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    // The reference's greeting block is deliberately smaller than a screen
    // title: a sentence-cased date over a 22pt greeting, not a shouted
    // all-caps label over a 27pt heading.
    dateLabel: {
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0.24,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.44,
      marginTop: 2,
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
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    heroTopLeft: {
      flex: 1,
    },
    // A translucent white chip holding the verification shield, top-right of
    // the hero -- the reference's counterweight to the blood-type letter.
    heroShield: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bloodTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 4,
    },
    bloodTypeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 10,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    // The blood type card is a vivid, saturated brand gradient rather than a
    // theme surface, so its text is fixed white in both themes -- the same
    // choice the reference design makes -- instead of `colors.text`, which
    // would go near-black and vanish in light mode.
    bloodTypeLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.1,
      color: 'rgba(255,255,255,0.7)',
    },
    // 64pt on Home specifically -- larger than the shared `bloodType` token,
    // matching the reference, where this is the single biggest glyph anywhere.
    bloodTypeValue: {
      fontSize: 64,
      fontWeight: '800',
      lineHeight: 64,
      letterSpacing: -2.56,
      color: '#FFFFFF',
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
      fontSize: 12,
      color: 'rgba(255,255,255,0.65)',
    },
    heroDivider: {
      marginTop: spacing.md,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    heroStatItem: {
      alignItems: 'center',
    },
    heroStatValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    heroStatValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    heroStatUnit: {
      fontSize: 12,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.7)',
    },
    heroStatLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      marginTop: 2,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    profileStat: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    completionTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    completionNote: {
      fontSize: 12,
    },
    // A success-tinted pill, not a neutral chip: the percentage is progress,
    // and the reference colours it accordingly.
    completionBadge: {
      backgroundColor: `${colors.success}26`,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    completionBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.success,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: spacing.lg,
    },
    quickAction: {
      flex: 1,
    },
    // Border and fill come from the danger tier itself -- overriding the
    // border here with the full-saturation accent made the card shout louder
    // than the reference's rose tint intends.
    sosCard: {},
    sosRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sosHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    sosTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.danger,
    },
    // The halo around the dot is the reference's `box-shadow: 0 0 0 3px`
    // ring, rendered here as a border on a slightly larger box.
    sosPulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
      borderWidth: 3,
      borderColor: 'rgba(216,83,96,0.30)',
    },
    sosText: {
      fontSize: 12,
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
  });
}