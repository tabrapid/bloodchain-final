import { useMemo } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Droplet,
  FileText,
  Heart,
  Info,
  MapPin,
  Shield,
  Siren,
  Star,
  UserRound,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Avatar,
  GlassCard,
  GradientCard,
  IconButton,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../src/components';
import { LucideIcon } from '../../src/types/icons';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile, useProfileCompletion } from '../../src/hooks/useDonors';
import { useNextAppointment } from '../../src/hooks/useAppointments';
import { useDonationStatistics } from '../../src/hooks/useDonations';
import { useGamificationProfile, useLevelProgress } from '../../src/hooks/useGamification';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useDonorEmergencies } from '../../src/hooks/useEmergency';
import { useAuthStore } from '../../src/stores/auth.store';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

export default function Home() {
  const { colors } = useTheme();
  const { t, formatDayHeading, formatDate, formatTime } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { data: userProfile } = useUserProfile();
  const { data: donorProfile } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: nextAppointment } = useNextAppointment();
  const { data: donationStats } = useDonationStatistics();
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: levelProgress } = useLevelProgress();
  const { data: unreadCount } = useUnreadCount();
  const { data: emergencies } = useDonorEmergencies();

  const fullName = userProfile
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
    : undefined;
  const activeEmergencyCount = emergencies?.active.length ?? 0;
  const completion = completionData?.data;
  const completionPercentage = completion?.percentage ?? 0;

  const firstName = userProfile?.firstName || user?.firstName || 'there';
  const greeting = getGreeting(t, firstName);

  const bloodTypeDisplay =
    donorProfile?.bloodType && donorProfile?.rhFactor
      ? `${donorProfile.bloodType}${donorProfile.rhFactor === 'POSITIVE' ? '+' : '-'}`
      : '—';

  const verification = getVerification(t, colors, donorProfile?.verificationStatus);

  // `nextEligibleDonationDate` is absent until the first donation sets a
  // cooldown, so "no date" means eligible, not unknown.
  const nextEligible = gamificationProfile?.nextEligibleDonationDate
    ? new Date(gamificationProfile.nextEligibleDonationDate)
    : null;
  const isEligible = !nextEligible || nextEligible.getTime() <= Date.now();

  const appointmentDate = nextAppointment ? new Date(nextAppointment.scheduledStart) : null;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText muted style={styles.dateLabel}>
{formatDayHeading(new Date())}
          </AppText>
          <AppText style={styles.greeting}>{greeting} 👋</AppText>
          <AppText muted style={styles.greetingNote}>
            {t('home.tagline')}
          </AppText>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon={Bell}
            onPress={() => router.push('/(app)/notifications')}
            badge={unreadCount?.count}
            accessibilityRole="button"
            accessibilityLabel={t('profile.notifications')}
          />
          <TouchableOpacity
            onPress={() => router.push('/(app)/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
          >
            <Avatar name={fullName ?? user?.firstName ?? 'Donor'} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      <GradientCard colors={colors.heroGradient} style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTopLeft}>
            <View style={styles.heroEyebrow}>
              <Droplet size={13} color="rgba(255,255,255,0.75)" fill="rgba(255,255,255,0.5)" />
              <AppText style={styles.heroEyebrowText}>{t('home.bloodTypeLabel')}</AppText>
            </View>
            <View style={styles.heroTypeRow}>
              <AppText style={styles.heroTypeValue}>{bloodTypeDisplay}</AppText>
              {/*
                The badge and the (i) are one control, and it goes where the
                status can actually be changed. An info glyph that only sits
                there is a question the screen refuses to answer.
              */}
              <Pressable
                onPress={() => router.push('/(app)/profile/donor')}
                accessibilityRole="button"
                accessibilityLabel={`Blood type status: ${verification.badge}. Open donor profile`}
                style={[styles.statusBadge, { backgroundColor: verification.badgeFill }]}
              >
                <AppText style={[styles.statusText, { color: verification.badgeText }]}>
                  {verification.badge}
                </AppText>
                <Info size={13} color={verification.badgeText} />
              </Pressable>
            </View>
            {donorProfile?.city && (
              <View style={styles.heroLocation}>
                <MapPin size={12} color="rgba(255,255,255,0.7)" />
                <AppText style={styles.heroLocationText}>
                  {donorProfile.city}
                  {donorProfile.district ? `, ${donorProfile.district}` : ''}
                </AppText>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => router.push('/(app)/profile/donor')}
            accessibilityRole="button"
            accessibilityLabel={verification.note}
            style={styles.heroVerification}
          >
            <View style={styles.heroShield}>
              <Shield size={26} color="#FFFFFF" strokeWidth={1.5} />
            </View>
            <View style={styles.heroVerificationRow}>
              <AppText style={styles.heroVerificationText}>{verification.note}</AppText>
              <ChevronRight size={15} color="rgba(255,255,255,0.75)" />
            </View>
          </Pressable>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroStatsRow}>
          <HeroStat
            icon={Droplet}
            value={`${donationStats?.completedCount ?? 0}`}
            label={t('home.donations')}
          />
          <HeroStat
            icon={BarChart3}
            value={
              donationStats?.totalVolumeMl
                ? (donationStats.totalVolumeMl / 1000).toFixed(1)
                : '0'
            }
            unit="L"
            label={t('home.totalVolume')}
          />
          <HeroStat
            icon={Heart}
            value={`${gamificationProfile?.emergencyResponseCount ?? 0}`}
            label={t('home.emergencyResponses')}
          />
        </View>
      </GradientCard>

      {/*
        Three questions a donor opens the app with -- can I give, when am I
        booked, how far along am I -- answered side by side instead of stacked
        down the screen as three full-width cards.
      */}
      <View style={styles.statusRow}>
        <StatusCard
          icon={CalendarCheck}
          accent={colors.success}
          label={t('home.eligibilityTitle')}
          value={isEligible ? t('home.eligibleNow') : formatDate(nextEligible!, 'medium')}
          valueColor={isEligible ? colors.onMuted.success : colors.text}
          note={
            isEligible
              ? t('home.eligibleToday')
              : t('home.eligibilityOpensThen')
          }
          onPress={() => router.push('/(booking)/select-type')}
        />
        <StatusCard
          icon={CalendarDays}
          accent={colors.secondary}
          label={t('home.nextAppointment')}
          value={appointmentDate ? formatDate(appointmentDate, 'medium') : t('home.noAppointment')}
          note={
            appointmentDate
              ? `${formatTime(appointmentDate)} · ${nextAppointment!.organization.name}`
              : t('home.scheduleNext')
          }
          onPress={() =>
            nextAppointment
              ? router.push(`/appointment/${nextAppointment.id}`)
              : router.push('/(booking)/select-type')
          }
        />
        <StatusCard
          icon={Star}
          accent={colors.ai}
          label={t('home.levelAndXp')}
          value={`Level ${levelProgress?.currentLevel ?? gamificationProfile?.level ?? 1}`}
          note={
            levelProgress
              ? `${levelProgress.currentXp} / ${levelProgress.xpForNextLevel} XP`
              : `${gamificationProfile?.totalXp ?? 0} XP`
          }
          progress={levelProgress?.progress ?? gamificationProfile?.progress}
          onPress={() => router.push('/(app)/gamification')}
        />
      </View>

      {completionPercentage < 100 && (
        <Pressable
          onPress={() => router.push('/(onboarding)/complete-profile')}
          accessibilityRole="button"
          accessibilityLabel={`{t('home.completeProfile')}, ${completionPercentage} percent done`}
        >
          <GlassCard style={styles.completionCard}>
            <View style={styles.completionRow}>
              <View style={styles.completionIcon}>
                <UserRound size={22} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.completionTitle}>{t('home.completeProfile')}</AppText>
                <AppText muted style={styles.completionNote}>
                  {t('home.completeProfileBody')}
                </AppText>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
            <View style={styles.completionProgressRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar progress={completionPercentage} />
              </View>
              <AppText muted style={styles.completionPercent}>
                {completionPercentage}%
              </AppText>
            </View>
          </GlassCard>
        </Pressable>
      )}

      <SectionHeader action={{ label: 'View all', onPress: () => router.push('/sos') }}>
        {t('home.emergency')}
      </SectionHeader>
      <Pressable
        onPress={() => router.push('/sos')}
        accessibilityRole="button"
        accessibilityLabel={
          activeEmergencyCount > 0
            ? t('home.emergenciesMatched', { count: activeEmergencyCount })
            : t('home.emergencyRequests')
        }
      >
        <GlassCard tier="danger">
          <View style={styles.emergencyRow}>
            <View style={styles.emergencyIcon}>
              <Siren size={24} color={colors.onMuted.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.emergencyTitle}>
                {activeEmergencyCount > 0
                  ? t('home.emergenciesMatched', { count: activeEmergencyCount })
                  : t('home.noEmergencies')}
              </AppText>
              <AppText muted style={styles.emergencyNote}>
                {activeEmergencyCount > 0
                  ? t('home.emergencyNearbyNeed')
                  : t('home.emergencyWillAlert')}
              </AppText>
            </View>
            {activeEmergencyCount > 0 ? (
              <AppButton variant="danger" size="small" onPress={() => router.push('/sos')}>
                {t('home.viewRequests')}
              </AppButton>
            ) : (
              <ChevronRight size={18} color={colors.textMuted} />
            )}
          </View>
        </GlassCard>
      </Pressable>

      <SectionHeader>{t('home.quickActions')}</SectionHeader>
      <View style={styles.quickActions}>
        <QuickAction
          icon={Droplet}
          accent={colors.primary}
          label={'Schedule\nDonation'}
          onPress={() => router.push('/(booking)/select-type')}
        />
        <QuickAction
          icon={FileText}
          accent={colors.secondary}
          label={'Edit Donor\nProfile'}
          onPress={() => router.push('/(app)/profile/donor')}
        />
        <QuickAction
          icon={UserRound}
          accent={colors.secondary}
          label={'Edit Personal\nInfo'}
          onPress={() => router.push('/(app)/profile/edit')}
        />
        <QuickAction
          icon={BookOpen}
          accent={colors.ai}
          label={'Learn About\nDonation'}
          onPress={() => router.push('/education')}
        />
      </View>
    </Screen>
  );
}

function HeroStat({
  icon: Icon,
  value,
  unit,
  label,
}: {
  icon: LucideIcon;
  value: string;
  unit?: string;
  label: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatIcon}>
        <Icon size={14} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.heroStatValueRow}>
          <AppText style={styles.heroStatValue}>{value}</AppText>
          {unit && <AppText style={styles.heroStatUnit}>{unit}</AppText>}
        </View>
        <AppText style={styles.heroStatLabel}>{label}</AppText>
      </View>
    </View>
  );
}

function StatusCard({
  icon: Icon,
  accent,
  label,
  value,
  valueColor,
  note,
  progress,
  onPress,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: string;
  valueColor?: string;
  note: string;
  progress?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${note}`}
      style={styles.statusCardWrapper}
    >
      <GlassCard style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: `${accent}26` }]}>
          <Icon size={17} color={accent} />
        </View>
        <AppText muted style={styles.statusLabel} numberOfLines={2}>
          {label}
        </AppText>
        <AppText style={[styles.statusValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
          {value}
        </AppText>
        {progress !== undefined && (
          <View style={styles.statusProgress}>
            <ProgressBar progress={progress} color={accent} />
          </View>
        )}
        <View style={styles.statusFooter}>
          <AppText muted style={styles.statusNote} numberOfLines={2}>
            {note}
          </AppText>
          <ChevronRight size={14} color={colors.textMuted} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

function QuickAction({
  icon: Icon,
  accent,
  label,
  onPress,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label.replace('\n', ' ')}
      style={styles.quickActionWrapper}
    >
      <GlassCard style={styles.quickActionCard}>
        <View style={[styles.quickActionIcon, { backgroundColor: `${accent}26` }]}>
          <Icon size={19} color={accent} />
        </View>
        <AppText style={styles.quickActionLabel}>{label}</AppText>
      </GlassCard>
    </Pressable>
  );
}

function getGreeting(t: TranslateFn, name: string): string {
  const hour = new Date().getHours();
  let timeGreeting: string;

  if (hour < 12) {
    timeGreeting = t('home.greetingMorning');
  } else if (hour < 17) {
    timeGreeting = t('home.greetingAfternoon');
  } else {
    timeGreeting = t('home.greetingEvening');
  }

  return `${timeGreeting}, ${name}`;
}

/** Badge wording, badge colour and the sentence beside the shield, in one place. */
function getVerification(
  t: TranslateFn,
  colors: ThemeColors,
  status: string | undefined,
): {
  badge: string;
  badgeFill: string;
  badgeText: string;
  note: string;
} {
  if (status === 'VERIFIED') {
    return {
      badge: t('home.verificationVerified'),
      badgeFill: colors.successMuted,
      badgeText: colors.onMuted.success,
      note: t('home.bloodTypeVerified'),
    };
  }
  if (status === 'REQUIRES_REVIEW') {
    return {
      badge: t('home.verificationUnderReview'),
      badgeFill: colors.warningMuted,
      badgeText: colors.onMuted.warning,
      note: t('home.verificationInProgress'),
    };
  }
  return {
    badge: t('home.verificationUnverified'),
    badgeFill: 'rgba(255,255,255,0.18)',
    badgeText: '#FFFFFF',
    note: t('home.verifyBloodType'),
  };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
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
      fontSize: 13,
      marginBottom: 2,
    },
    greeting: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.6,
      color: colors.text,
    },
    greetingNote: {
      fontSize: 13,
      marginTop: 4,
    },

    heroCard: {
      marginBottom: layout.cardGap,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    heroTopLeft: {
      flex: 1,
    },
    heroEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroEyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.3,
      color: 'rgba(255,255,255,0.78)',
    },
    heroTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: 2,
    },
    heroTypeValue: {
      fontSize: 46,
      lineHeight: 54,
      fontWeight: '800',
      letterSpacing: -2,
      color: '#FFFFFF',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    heroLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    heroLocationText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
    },
    heroVerification: {
      width: 104,
      alignItems: 'center',
    },
    heroShield: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    heroVerificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: 8,
    },
    heroVerificationText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'center',
      color: 'rgba(255,255,255,0.86)',
    },
    heroDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginVertical: spacing.md,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    heroStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    heroStatIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroStatValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    heroStatValue: {
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: '#FFFFFF',
    },
    heroStatUnit: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.8)',
    },
    heroStatLabel: {
      fontSize: 10,
      lineHeight: 13,
      color: 'rgba(255,255,255,0.78)',
    },

    statusRow: {
      flexDirection: 'row',
      gap: layout.cardGap,
      marginBottom: layout.cardGap,
    },
    statusCardWrapper: {
      flex: 1,
    },
    statusCard: {
      flex: 1,
      padding: 12,
    },
    statusIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    statusLabel: {
      fontSize: 11,
      lineHeight: 14,
    },
    statusValue: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginTop: 2,
      color: colors.text,
    },
    statusProgress: {
      marginTop: 8,
    },
    statusFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      marginTop: 6,
    },
    statusNote: {
      flex: 1,
      fontSize: 10,
      lineHeight: 13,
    },

    completionCard: {
      marginBottom: layout.cardGap,
    },
    completionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    completionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    completionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    completionNote: {
      fontSize: 12,
      marginTop: 2,
    },
    completionProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    completionPercent: {
      fontSize: 12,
      fontWeight: '700',
    },

    emergencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    emergencyIcon: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerMuted,
    },
    emergencyTitle: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.text,
    },
    emergencyNote: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },

    quickActions: {
      flexDirection: 'row',
      gap: layout.cardGap,
    },
    quickActionWrapper: {
      flex: 1,
    },
    quickActionCard: {
      flex: 1,
      padding: 10,
      alignItems: 'center',
    },
    quickActionIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    quickActionLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text,
    },
  });
}
