import { router } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  AppButton,
  AppText,
  Avatar,
  Badge,
  Card,
  Divider,
  GlassCard,
  GradientCard,
  ListItem,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../src/components';
import { achievementIconMap } from '../../src/components/gamification/AchievementCard';
import { useLogout } from '../../src/hooks/useAuth';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { useProfileCompletion } from '../../src/hooks/useDonors';
import { useGamificationProfile, useLevelProgress, useAchievements } from '../../src/hooks/useGamification';
import { spacing, radius, typography, useTheme, ThemeColors } from '../../src/theme';
import { Award, Bell, ChevronRight, Droplet, Lock, Shield, User } from 'lucide-react-native';
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
  const badgePreviews = (achievements?.unlocked.length ? achievements.unlocked : achievements?.inProgress ?? []).slice(0, 3);

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Donor'
    : 'Loading...';

  const bloodTypeDisplay = donor?.bloodType && donor?.rhFactor
    ? `${donor.bloodType}${donor.rhFactor === 'POSITIVE' ? '+' : '-'}`
    : '—';

  const verificationShortLabel = donor?.verificationStatus === 'VERIFIED'
    ? 'Verified'
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? 'Under Review'
    : 'Unverified';

  const verificationLabel = donor?.verificationStatus === 'VERIFIED'
    ? 'Verified Donor'
    : verificationShortLabel;

  const statusDotColor = donor?.verificationStatus === 'VERIFIED'
    ? colors.success
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.warning
    : colors.textMuted;

  const statusTextColor = donor?.verificationStatus === 'VERIFIED'
    ? colors.onMuted.success
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.onMuted.warning
    : colors.textMuted;

  const statusBg = donor?.verificationStatus === 'VERIFIED'
    ? colors.successMuted
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? colors.warningMuted
    : colors.surfaceElevated;

  const statusColor = statusTextColor;

  const verificationBadgeVariant = donor?.verificationStatus === 'VERIFIED'
    ? 'success'
    : donor?.verificationStatus === 'REQUIRES_REVIEW'
    ? 'warning'
    : 'default';

  return (
    <Screen>
      <AppText variant="title">Profile</AppText>

      <GlassCard elevated style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatarRing, { borderColor: statusDotColor }]}>
            <Avatar name={fullName} size={72} />
          </View>
          <AppText style={styles.profileName} numberOfLines={1}>
            {fullName}
          </AppText>
          <AppText muted style={styles.emailText} numberOfLines={1}>
            {user?.email}
          </AppText>
          <View style={styles.badgeRow}>
            <Badge variant="primary">{bloodTypeDisplay} Blood Type</Badge>
            <Badge variant={verificationBadgeVariant}>{verificationLabel}</Badge>
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
            {badgePreviews.length > 0 && (
              <View style={styles.badgePreviewRow}>
                {badgePreviews.map((badge) => {
                  const BadgeIcon = achievementIconMap[badge.icon] ?? Award;
                  return (
                    <View key={badge.id} style={styles.badgePreview}>
                      <BadgeIcon size={13} color={colors.onMuted.warning} />
                    </View>
                  );
                })}
              </View>
            )}
            <ChevronRight size={18} color={colors.textMuted} />
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
        colors={colors.heroGradient}
        style={styles.bloodTypeCard}
      >
        <Droplet
          size={140}
          color="rgba(255,255,255,0.10)"
          fill="rgba(255,255,255,0.06)"
          style={styles.bloodTypeWatermark}
        />
        <View style={styles.bloodTypeHeader}>
          <Droplet size={16} color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.5)" />
          <AppText style={styles.bloodTypeEyebrow}>YOUR BLOOD TYPE</AppText>
        </View>
        <View style={styles.bloodTypeValue}>
          <AppText style={styles.bloodTypeText}>{bloodTypeDisplay}</AppText>
          <View style={[styles.verificationBadge, { backgroundColor: statusBg }]}>
            <AppText style={[styles.verificationText, { color: statusColor }]}>
              {verificationShortLabel}
            </AppText>
          </View>
        </View>
        {donor?.bloodTypeSource && (
          <AppText style={[styles.sourceText, styles.onGradientMuted]}>
            Source: {donor.bloodTypeSource.replace(/_/g, ' ')}
          </AppText>
        )}
      </GradientCard>

      <SectionHeader>DONOR INFO</SectionHeader>
      <Card>
        <ListItem
          title="Donor Profile"
          subtitle="Blood type, eligibility, preferences"
          icon={Droplet}
          onPress={() => router.push('/(app)/profile/donor')}
        />
        <Divider />
        <ListItem
          title="Personal Info"
          subtitle="Name, contact, address"
          icon={User}
          onPress={() => router.push('/(app)/profile/edit')}
        />
      </Card>

      <SectionHeader>SETTINGS</SectionHeader>
      <Card>
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

      {/* Sign-out sits in its own card rather than under a section header --
          the reference gives it no label, just the action. */}
      <Card style={styles.signOutCard}>
        <ListItem title="Sign out" destructive onPress={() => logout.mutate()} />
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
    // Centred identity block, as the reference has it: avatar over name over
    // email over a pair of badges -- not a left-aligned row.
    profileHeader: {
      alignItems: 'center',
    },
    avatarRing: {
      padding: 3,
      borderRadius: radius.pill,
      borderWidth: 2,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 14,
    },
    emailText: {
      fontSize: 13,
      marginTop: 2,
    },
    badgeRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: 10,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 11,
      marginTop: 3,
      textAlign: 'center',
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
    badgePreviewRow: {
      flexDirection: 'row',
      gap: 4,
    },
    badgePreview: {
      width: 26,
      height: 26,
      borderRadius: 13,
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
    bloodTypeWatermark: {
      position: 'absolute',
      top: -24,
      right: -24,
    },
    bloodTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    bloodTypeEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: 'rgba(255,255,255,0.85)',
    },
    bloodTypeValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    bloodTypeText: {
      ...typography.bloodType,
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
    signOutCard: {
      marginTop: spacing.lg,
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