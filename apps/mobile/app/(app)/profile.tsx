import { router } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  AppButton,
  AppText,
  Avatar,
  Card,
  Divider,
  GlassCard,
  GradientCard,
  ListItem,
  ProgressBar,
  Screen,
  SectionHeader,
  StatCard,
} from '../../src/components';
import { useLogout } from '../../src/hooks/useAuth';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { useProfileCompletion } from '../../src/hooks/useDonors';
import { useGamificationProfile, useLevelProgress, useAchievements } from '../../src/hooks/useGamification';
import { spacing, useTheme, ThemeColors } from '../../src/theme';
import { Award, Bell, Droplet, Lock, Shield, User } from 'lucide-react-native';
import { useMemo } from 'react';

export default function Profile() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const logout = useLogout();
  const { data: user } = useUserProfile();
  const { data: donor } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: levelProgress } = useLevelProgress();
  const { data: achievements } = useAchievements();

  const completion = completionData?.data;
  const unlockedCount = achievements?.unlocked.length ?? 0;
  const inProgressCount = achievements?.inProgress.length ?? 0;

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Donor'
    : 'Loading...';

  const bloodTypeDisplay = donor?.bloodType && donor?.rhFactor
    ? `${donor.bloodType}${donor.rhFactor === 'POSITIVE' ? '+' : '-'}`
    : '—';

  const verificationLabel = donor?.verificationStatus === 'VERIFIED'
    ? 'Verified'
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? 'Under Review'
    : 'Unverified';

  const statusBg = donor?.verificationStatus === 'VERIFIED'
    ? colors.successMuted
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.warningMuted
    : colors.surfaceElevated;

  const statusColor = donor?.verificationStatus === 'VERIFIED'
    ? colors.onMuted.success
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.onMuted.warning
    : colors.textMuted;

  return (
    <Screen>
      <AppText variant="title">Profile</AppText>

      <GlassCard elevated style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar name={fullName} size={72} />
          <View style={styles.profileInfo}>
            <AppText variant="title">{fullName}</AppText>
            <AppText muted>{user?.email}</AppText>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <AppText style={[styles.statusText, { color: statusColor }]}>
                {verificationLabel}
              </AppText>
            </View>
          </View>
        </View>

        {gamificationProfile && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <AppText variant="heading" style={styles.statValue}>
                {gamificationProfile.donationCount}
              </AppText>
              <AppText muted style={styles.statLabel}>
                Donations
              </AppText>
            </View>
            <View style={styles.statItem}>
              <AppText variant="heading" style={styles.statValue}>
                {gamificationProfile.emergencyResponseCount}
              </AppText>
              <AppText muted style={styles.statLabel}>
                Emergency responses
              </AppText>
            </View>
            <View style={styles.statItem}>
              <AppText variant="heading" style={styles.statValue}>
                {gamificationProfile.totalXp}
              </AppText>
              <AppText muted style={styles.statLabel}>
                XP
              </AppText>
            </View>
          </View>
        )}

        {levelProgress && !levelProgress.isMaxLevel && (
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <AppText muted style={styles.xpLabel}>
                {levelProgress.currentLevelName} → {levelProgress.nextLevelName}
              </AppText>
              <AppText style={styles.xpValue}>
                {levelProgress.currentXp} / {levelProgress.xpForNextLevel} XP
              </AppText>
            </View>
            <ProgressBar progress={levelProgress.progress} color={colors.warning} />
          </View>
        )}

        <AppButton
          variant="secondary"
          size="small"
          onPress={() => router.push('/(app)/profile/edit')}
          style={styles.editButton}
        >
          Edit Profile
        </AppButton>
      </GlassCard>

      <TouchableOpacity
        onPress={() => router.push('/(app)/gamification')}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.gamificationTeaser}>
          <View style={styles.gamificationTeaserRow}>
            <View style={styles.gamificationIcon}>
              <Award size={22} color={colors.onMuted.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ fontWeight: '600' }}>
                Achievements & Badges
              </AppText>
              <AppText muted style={{ fontSize: 12 }}>
                {unlockedCount} earned · {inProgressCount} in progress
              </AppText>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>

      {completion && (
        <GradientCard
          colors={[colors.success, colors.secondary]}
          style={styles.completionCard}
        >
          <View style={styles.completionHeader}>
            <AppText variant="heading" style={styles.onGradientText}>
              Profile Completion
            </AppText>
            <AppText variant="heading" style={styles.onGradientText}>
              {completion.percentage}%
            </AppText>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${completion.percentage}%` },
              ]}
            />
          </View>
          {completion.missing.length > 0 && (
            <AppText style={[styles.missingText, styles.onGradientMuted]}>
              Missing: {completion.missing.join(', ').replace(/_/g, ' ')}
            </AppText>
          )}
        </GradientCard>
      )}

      <GradientCard
        colors={[colors.primary, colors.ai]}
        style={styles.bloodTypeCard}
      >
        <View style={styles.bloodTypeHeader}>
          <Droplet size={24} color="#FFFFFF" />
          <AppText variant="heading" style={styles.onGradientText}>
            Blood Type
          </AppText>
        </View>
        <View style={styles.bloodTypeValue}>
          <AppText variant="numeric" style={styles.bloodTypeText}>
            {bloodTypeDisplay}
          </AppText>
          <View style={[styles.verificationBadge, { backgroundColor: statusBg }]}>
            <AppText style={[styles.verificationText, { color: statusColor }]}>
              {verificationLabel}
            </AppText>
          </View>
        </View>
        {donor?.bloodTypeSource && (
          <AppText style={[styles.sourceText, styles.onGradientMuted]}>
            Source: {donor.bloodTypeSource.replace(/_/g, ' ')}
          </AppText>
        )}
      </GradientCard>

      <SectionHeader>ACCOUNT</SectionHeader>
      <Card>
        <ListItem
          title="Personal Information"
          subtitle="Name, email, phone"
          icon={User}
          onPress={() => router.push('/(app)/profile/edit')}
        />
        <Divider />
        <ListItem
          title="Donor Profile"
          subtitle="Blood type, location, preferences"
          icon={Droplet}
          onPress={() => router.push('/(app)/profile/donor')}
        />
        <Divider />
        <ListItem
          title="Notifications"
          icon={Bell}
          onPress={() => router.push('/(app)/notifications')}
        />
        <Divider />
        <ListItem
          title="Privacy"
          icon={Lock}
          onPress={() => router.push('/(app)/privacy')}
        />
        <Divider />
        <ListItem
          title="Security"
          icon={Shield}
          onPress={() => router.push('/(app)/security')}
        />
      </Card>

      <SectionHeader>SESSION</SectionHeader>
      <Card>
        <ListItem
          title="Log out"
          destructive
          onPress={() => logout.mutate()}
        />
      </Card>

      <View style={styles.footer}>
        <AppText muted style={styles.version}>
          DONOR v0.2.0 — Phase 3
        </AppText>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    profileCard: {
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    profileInfo: {
      flex: 1,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.xs,
      marginTop: spacing.xs,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
    },
    statLabel: {
      fontSize: 11,
      marginTop: 2,
    },
    xpSection: {
      marginTop: spacing.md,
    },
    xpLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    xpLabel: {
      fontSize: 11,
    },
    xpValue: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning,
    },
    editButton: {
      marginTop: spacing.md,
    },
    gamificationTeaser: {
      marginBottom: spacing.lg,
    },
    gamificationTeaserRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    gamificationIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.warningMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completionCard: {
      marginBottom: spacing.lg,
    },
    completionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    // These two cards are vivid, saturated brand gradients rather than a
    // theme surface, so their text is fixed white/near-white in both themes
    // instead of `colors.text`, which would go near-black and vanish in
    // light mode -- the same choice the reference design makes.
    onGradientText: {
      color: '#FFFFFF',
    },
    onGradientMuted: {
      color: 'rgba(255,255,255,0.75)',
    },
    progressBar: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 3,
    },
    missingText: {
      fontSize: 12,
      marginTop: spacing.sm,
      textTransform: 'capitalize',
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
    bloodTypeValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    bloodTypeText: {
      color: '#FFFFFF',
    },
    verificationBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.xs,
    },
    verificationText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sourceText: {
      fontSize: 12,
      marginTop: spacing.sm,
    },
    footer: {
      marginTop: spacing.xl,
      paddingVertical: spacing.lg,
    },
    version: {
      textAlign: 'center',
    },
  });
}