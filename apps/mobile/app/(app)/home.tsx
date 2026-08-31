import { useMemo } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, Calendar, Droplet, TrendingUp, Zap, ChevronRight, Clock } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Avatar,
  Card,
  GlassCard,
  GradientCard,
  IconButton,
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
import { spacing, radius, typography, useTheme, ThemeColors } from '../../src/theme';

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
              month: 'long',
            }).toUpperCase()}
          </AppText>
          <AppText variant="title" style={styles.greeting}>
            {greeting}
          </AppText>
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
        colors={[colors.primary, colors.ai]}
        style={styles.bloodTypeCard}
      >
        <Droplet
          size={130}
          color="rgba(255,255,255,0.10)"
          fill="rgba(255,255,255,0.06)"
          style={styles.bloodTypeWatermark}
        />
        <View style={styles.bloodTypeHeader}>
          <Droplet size={14} color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.5)" />
          <AppText style={styles.bloodTypeLabel}>BLOOD TYPE</AppText>
        </View>
        <View style={styles.bloodTypeContent}>
          <AppText style={styles.bloodTypeValue}>{bloodTypeDisplay}</AppText>
          <View style={[styles.statusBadge, { backgroundColor: bloodTypeColor }]}>
            <AppText style={[styles.statusText, { color: bloodTypeTextColor }]}>
              {bloodTypeStatus}
            </AppText>
          </View>
        </View>
        {donorProfile?.city && (
          <AppText style={styles.locationText}>
            {donorProfile.city}
            {donorProfile.district ? `, ${donorProfile.district}` : ''}
          </AppText>
        )}
        <View style={styles.heroDivider} />
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <AppText style={styles.heroStatValue}>{donationStats?.completedCount ?? 0}</AppText>
            <AppText style={styles.heroStatLabel}>Donations</AppText>
          </View>
          <View style={styles.heroStatItem}>
            <AppText style={styles.heroStatValue}>
              {donationStats?.totalVolumeMl ? (donationStats.totalVolumeMl / 1000).toFixed(1) : '0'}L
            </AppText>
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
        <TouchableOpacity
          onPress={() => router.push('/donations')}
          activeOpacity={0.8}
          style={styles.donationStatCard}
        >
          <GlassCard style={styles.statGlassCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryMuted }]}>
              <Droplet size={18} color={colors.onMuted.primary} />
            </View>
            <AppText variant="numeric" style={styles.statValue}>
              {donationStats?.completedCount ?? 0}
            </AppText>
            <AppText muted style={styles.statNote}>
              Donations
            </AppText>
          </GlassCard>
        </TouchableOpacity>
        <View style={styles.donationStatCard}>
          <GlassCard style={styles.statGlassCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.secondaryMuted }]}>
              <TrendingUp size={18} color={colors.onMuted.secondary} />
            </View>
            <AppText variant="numeric" style={styles.statValue}>
              {donationStats?.totalVolumeMl
                ? (donationStats.totalVolumeMl / 1000).toFixed(1)
                : '0'}
              <AppText style={styles.statUnit}>L</AppText>
            </AppText>
            <AppText muted style={styles.statNote}>
              Total volume
            </AppText>
          </GlassCard>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/gamification')}
          activeOpacity={0.8}
          style={styles.donationStatCard}
        >
          <GlassCard style={styles.statGlassCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.warningMuted }]}>
              <Zap size={18} color={colors.onMuted.warning} />
            </View>
            <AppText variant="numeric" style={styles.statValue}>
              {gamificationProfile?.totalXp ?? 0}
            </AppText>
            <AppText muted style={styles.statNote}>
              XP points
            </AppText>
          </GlassCard>
        </TouchableOpacity>
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
      <GlassCard danger={activeEmergencyCount > 0} style={styles.sosCard}>
        <View style={styles.sosHeader}>
          <AppText variant="heading" style={{ color: colors.danger }}>
            SOS Blood Requests
          </AppText>
          {activeEmergencyCount > 0 && <View style={styles.sosPulseDot} />}
        </View>
        <AppText muted style={styles.sosText}>
          {activeEmergencyCount > 0
            ? `${activeEmergencyCount} active emergency ${activeEmergencyCount === 1 ? 'request' : 'requests'} near you.`
            : 'No active emergency requests right now.'}
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
    dateLabel: {
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    greeting: {},
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
    bloodTypeWatermark: {
      position: 'absolute',
      top: -20,
      right: -20,
    },
    bloodTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    bloodTypeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    // The blood type card is a vivid, saturated brand gradient rather than a
    // theme surface, so its text is fixed white in both themes -- the same
    // choice the reference design makes -- instead of `colors.text`, which
    // would go near-black and vanish in light mode.
    bloodTypeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: 'rgba(255,255,255,0.85)',
    },
    bloodTypeValue: {
      ...typography.bloodType,
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
      marginTop: spacing.sm,
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
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
    heroStatValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
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
      borderColor: colors.danger,
    },
    sosHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sosPulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
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
      borderRadius: 12,
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
    statUnit: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },
    statNote: {
      fontSize: 12,
      textAlign: 'center',
    },
  });
}