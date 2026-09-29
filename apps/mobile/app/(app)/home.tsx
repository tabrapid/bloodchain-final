import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarPlus,
  ChevronRight,
  Droplet,
  FileText,
  Heart,
  MapPin,
  ShieldCheck,
  Siren,
  UserRound,
} from 'lucide-react-native';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  DateBlock,
  EmergencyBanner,
  IconButton,
  ListGroup,
  ListRow,
  Progress,
  Row,
  ScrollScreen,
  Section,
  SectionError,
  Sections,
  Skeleton,
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
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile, useProfileCompletion } from '../../src/hooks/useDonors';
import { useNextAppointment } from '../../src/hooks/useAppointments';
import { useDonationStatistics } from '../../src/hooks/useDonations';
import { useGamificationProfile, useLevelProgress } from '../../src/hooks/useGamification';
import { percentAsFraction } from '../../src/utils/progress';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useDonorEmergencies } from '../../src/hooks/useEmergency';
import { useAuthStore } from '../../src/stores/auth.store';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

/**
 * Home, composed for V4.
 *
 * The brief: within seconds the donor should know who they are, their blood
 * type, whether it is verified, whether they can donate, when their next
 * appointment is, and whether anything needs attention -- and gamification
 * must never outrank any of that.
 *
 * So the screen is one composition rather than a stack of cards:
 *
 *   1. A greeting line with the two controls a donor reaches for daily.
 *   2. The identity hero: blood type, verification and location on the one
 *      gradient surface in the system, with donation eligibility as a strip
 *      along its foot. Identity and eligibility are the two facts a blood
 *      service cares about, so they share a surface.
 *   3. What needs attention: the emergency, if there is one, in the only red
 *      the app has; an incomplete profile as a quiet row.
 *   4. The next appointment, as one row with a date block.
 *   5. Impact: three numbers, then the level as the quietest line in the
 *      section.
 *   6. Shortcuts, as rows.
 */
export default function Home() {
  const { colors } = useDesign();
  const { t, formatDayHeading, formatDate, formatTime, formatMonth } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: userProfile } = useUserProfile();
  const { data: donorProfile, isPending: donorPending } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const appointmentQuery = useNextAppointment();
  const nextAppointment = appointmentQuery.data;
  const statsQuery = useDonationStatistics();
  const donationStats = statsQuery.data;
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: levelProgress } = useLevelProgress();
  const { data: unreadCount } = useUnreadCount();
  const { data: emergencies } = useDonorEmergencies();

  const fullName = userProfile
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
    : undefined;
  const activeEmergencyCount = emergencies?.active.length ?? 0;
  const completionPercentage = completionData?.percentage ?? 0;

  const firstName = userProfile?.firstName || user?.firstName || 'there';
  const greeting = getGreeting(t, firstName);

  const bloodTypeDisplay =
    donorProfile?.bloodType && donorProfile?.rhFactor
      ? `${donorProfile.bloodType}${donorProfile.rhFactor === 'POSITIVE' ? '+' : '-'}`
      : '—';

  const verification = getVerification(t, donorProfile?.verificationStatus);

  // `nextEligibleDonationDate` is absent until the first donation sets a
  // cooldown, so "no date" means eligible, not unknown.
  const nextEligible = gamificationProfile?.nextEligibleDonationDate
    ? new Date(gamificationProfile.nextEligibleDonationDate)
    : null;
  const isEligible = !nextEligible || nextEligible.getTime() <= Date.now();

  const appointmentDate = nextAppointment ? new Date(nextAppointment.scheduledStart) : null;
  const location = donorProfile?.city
    ? [donorProfile.city, donorProfile.district].filter(Boolean).join(', ')
    : null;

  const heroLabel = donorPending
    ? t('common.loading')
    : `${t('home.bloodTypeLabel')} ${bloodTypeDisplay}. ${verification.note}. ${
        isEligible ? t('home.eligibleToday') : t('home.eligibilityOpensThen')
      }. ${t('home.verificationOpenProfile')}`;

  return (
    <ScrollScreen>
      <Sections rhythm="major">
        {/* ------------------------------------------------- the greeting */}
        <Row align="center" gap="md" style={{ paddingTop: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {formatDayHeading(new Date())}
            </Text>
            <Text variant="h2" numberOfLines={2}>
              {greeting}
            </Text>
          </View>
          <Row gap="sm">
            <View>
              <IconButton
                accessibilityLabel={
                  unreadCount?.count
                    ? `${t('profile.notifications')}, ${t('notifications.unreadCount', { count: unreadCount.count })}`
                    : t('profile.notifications')
                }
                onPress={() => router.push('/(app)/notifications')}
                variant="surface"
                icon={({ size, color }) => <Bell size={size} color={color} />}
              />
              {unreadCount?.count ? (
                <View
                  // Decorative: the count is already in the button's label.
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: radius.full,
                    backgroundColor: colors.critical.fill,
                    borderWidth: 2,
                    borderColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" tone="onAccent" style={{ fontSize: 10, lineHeight: 12 }}>
                    {unreadCount.count > 9 ? '9+' : unreadCount.count}
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push('/(app)/profile')}
              accessibilityRole="button"
              accessibilityLabel={t('profile.title')}
              hitSlop={8}
            >
              <Avatar name={fullName ?? user?.firstName ?? t('table.donor')} size={44} />
            </Pressable>
          </Row>
        </Row>

        {/* ------------------------------------------------ the identity hero */}
        <Surface
          hero
          corner="xl"
          padded={false}
          onPress={() => router.push('/(app)/profile/donor')}
          accessibilityLabel={heroLabel}
        >
          <View style={{ padding: space.xl - 4, paddingBottom: space.lg, gap: space.lg }}>
            <Row align="flex-start" gap="lg">
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('home.bloodTypeLabel')}
                </Text>
                {donorPending ? (
                  <Skeleton width={96} height={52} corner="sm" />
                ) : (
                  <ValueText variant="hero" style={{ color: colors.textPrimary }}>
                    {bloodTypeDisplay}
                  </ValueText>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: space.sm, maxWidth: '55%' }}>
                {donorPending ? (
                  <Skeleton width={96} height={24} corner="full" />
                ) : (
                  <Badge
                    label={verification.badge}
                    tone={verification.tone}
                    icon={verification.tone === 'success' ? ({ size, color }) => <ShieldCheck size={size} color={color} /> : undefined}
                    dot={verification.tone !== 'success'}
                  />
                )}
                {!donorPending ? (
                  <Text variant="caption" tone="secondary" align="right">
                    {verification.note}
                  </Text>
                ) : null}
                {location && !donorPending ? (
                  <Row gap="xs">
                    <MapPin size={12} color={colors.textTertiary} />
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {location}
                    </Text>
                  </Row>
                ) : null}
              </View>
            </Row>
          </View>

          {/* The eligibility strip: the second fact the hero carries. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.xl - 4,
              paddingVertical: space.md + 2,
              backgroundColor: isEligible ? colors.success.soft : 'rgba(255,255,255,0.05)',
            }}
          >
            <CalendarCheck2
              size={iconSize.md}
              color={isEligible ? colors.success.base : colors.textSecondary}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="bodyMedium" tone={isEligible ? 'success' : 'primary'}>
                {isEligible ? t('home.eligibleNow') : t('home.eligibilityTitle')}
              </Text>
              <Text variant="caption" tone="secondary">
                {isEligible
                  ? t('home.eligibleToday')
                  : `${t('home.eligibilityOpensThen')} ${formatDate(nextEligible!, 'medium')}`}
              </Text>
            </View>
            <ChevronRight size={iconSize.md} color={colors.textTertiary} />
          </View>
        </Surface>

        {/* -------------------------------------------- what needs attention */}
        {activeEmergencyCount > 0 || completionPercentage < 100 ? (
          <Section gap="related">
            {activeEmergencyCount > 0 ? (
              <EmergencyBanner
                title={t('home.emergenciesMatched', { count: activeEmergencyCount })}
                description={t('home.emergencyNearbyNeed')}
                icon={({ size, color }) => <Siren size={size} color={color} />}
                action={
                  <Button
                    label={t('home.viewRequests')}
                    variant="secondary"
                    size="md"
                    block={false}
                    onAccent
                    onPress={() => router.push('/sos')}
                  />
                }
              />
            ) : null}

            {completionPercentage < 100 ? (
              <Surface
                level="flat"
                padded="lg"
                onPress={() => router.push('/(onboarding)/complete-profile')}
                accessibilityLabel={`${t('home.completeProfile')}. ${completionPercentage}%`}
              >
                <View style={{ gap: space.md }}>
                  <Row gap="md">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.clinical.soft,
                      }}
                    >
                      <UserRound size={iconSize.md} color={colors.clinical.base} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyMedium">{t('home.completeProfile')}</Text>
                      <Text variant="caption" tone="secondary">
                        {t('home.completeProfileBody')}
                      </Text>
                    </View>
                    <Text variant="label" tone="clinical" style={{ fontVariant: ['tabular-nums'] }}>
                      {completionPercentage}%
                    </Text>
                  </Row>
                  <Progress
                    label={t('home.completeProfile')}
                    value={completionPercentage / 100}
                    tone="clinical"
                    thickness="thin"
                    bare
                  />
                </View>
              </Surface>
            ) : null}
          </Section>
        ) : null}

        {/* ---------------------------------------------- the next appointment */}
        <Section title={t('home.nextAppointment')}>
          {appointmentQuery.isError ? (
            <SectionError
              message={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void appointmentQuery.refetch()}
            />
          ) : appointmentDate ? (
            <Surface
              level="flat"
              onPress={() => router.push(`/appointment/${nextAppointment!.id}`)}
              accessibilityLabel={`${formatDate(appointmentDate, 'long')}, ${formatTime(appointmentDate)}, ${
                nextAppointment!.organization.name
              }`}
            >
              <Row gap="lg">
                <DateBlock
                  day={String(appointmentDate.getDate())}
                  month={formatMonth(appointmentDate, 'short').replace(/\s?\d{4}.*$/, '')}
                  tone="rose"
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium" numberOfLines={2}>
                    {nextAppointment!.organization.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {`${formatDate(appointmentDate, 'medium')} · ${formatTime(appointmentDate)}`}
                  </Text>
                </View>
                <ChevronRight size={iconSize.md} color={colors.textTertiary} />
              </Row>
            </Surface>
          ) : (
            <Surface level="flat">
              <Row gap="lg">
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium">{t('home.noAppointment')}</Text>
                  <Text variant="caption" tone="secondary">
                    {t('home.scheduleNext')}
                  </Text>
                </View>
                <Button
                  label={t('calendar.schedule')}
                  size="md"
                  block={false}
                  icon={({ size, color }) => <CalendarPlus size={size} color={color} />}
                  onPress={() => router.push('/(booking)/select-type')}
                />
              </Row>
            </Surface>
          )}
        </Section>

        {/* ------------------------------------------ what you have done */}
        <Section title={t('home.impact')}>
          {/* A failed request is not zero donations. The numbers are only
              drawn when they are the donor's numbers. */}
          {statsQuery.isError ? (
            <SectionError
              message={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void statsQuery.refetch()}
            />
          ) : (
          <StatRow>
            <Stat
              label={t('home.donations')}
              value={String(donationStats?.completedCount ?? 0)}
              icon={({ size, color }) => <Droplet size={size} color={color} />}
              tone="rose"
            />
            <Stat
              label={t('home.totalVolume')}
              value={donationStats?.totalVolumeMl ? (donationStats.totalVolumeMl / 1000).toFixed(1) : '0'}
              unit="L"
            />
            <Stat
              label={t('home.emergencyResponses')}
              value={String(gamificationProfile?.emergencyResponseCount ?? 0)}
              icon={({ size, color }) => <Heart size={size} color={color} />}
            />
          </StatRow>
          )}

          {/* The level: real, and the quietest thing in the section. A game
              mechanic never sits at the weight of a medical fact. */}
          {levelProgress ? (
            <View style={{ paddingHorizontal: space.xs }}>
              <Progress
                label={`${t('home.levelAndXp')} ${levelProgress.currentLevel}`}
                caption={t('gamification.xpToNext', {
                  count: levelProgress.xpToNextLevel,
                  level: levelProgress.nextLevelName,
                })}
                value={percentAsFraction(levelProgress.progress)}
                thickness="thin"
              />
            </View>
          ) : null}
        </Section>

        {/* ------------------------------------------------ shortcuts */}
        <Section title={t('home.quickActions')}>
          <ListGroup
            rows={[
              <QuickRow
                key="schedule"
                icon={Droplet}
                tone="rose"
                label={t('home.quickActionSchedule')}
                onPress={() => router.push('/(booking)/select-type')}
              />,
              <QuickRow
                key="donor"
                icon={FileText}
                tone="clinical"
                label={t('home.quickActionDonorProfile')}
                onPress={() => router.push('/(app)/profile/donor')}
              />,
              <QuickRow
                key="personal"
                icon={UserRound}
                tone="clinical"
                label={t('home.quickActionPersonalInfo')}
                onPress={() => router.push('/(app)/profile/edit')}
              />,
              <QuickRow
                key="learn"
                icon={BookOpen}
                tone="clinical"
                label={t('home.quickActionLearn')}
                onPress={() => router.push('/education')}
              />,
            ]}
          />
        </Section>

        {/* Kept last and quiet: when there is no emergency, saying so is
            reassurance, not news. */}
        {activeEmergencyCount === 0 ? (
          <Banner
            tone="neutral"
            title={t('home.noEmergencies')}
            description={t('home.emergencyWillAlert')}
            icon={({ size, color }) => <Siren size={size} color={color} />}
          />
        ) : null}
      </Sections>
    </ScrollScreen>
  );
}

function QuickRow({
  icon: Icon,
  tone,
  label,
  onPress,
}: {
  icon: LucideIcon;
  tone: AccentName;
  label: string;
  onPress: () => void;
}) {
  return (
    <ListRow
      title={label}
      icon={({ size, color }) => <Icon size={size} color={color} />}
      iconTone={tone}
      onPress={onPress}
    />
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

/**
 * Badge wording, badge tone and the sentence beside it, in one place.
 *
 * Returns a tone name rather than colours: the component decides how a tone is
 * drawn, and a screen that picks its own hex is a screen that will disagree
 * with the next one.
 */
function getVerification(
  t: TranslateFn,
  status: string | undefined,
): { badge: string; tone: AccentName; note: string } {
  if (status === 'VERIFIED') {
    return {
      badge: t('status.verification.VERIFIED'),
      tone: 'success',
      note: t('home.bloodTypeVerified'),
    };
  }
  if (status === 'REQUIRES_REVIEW') {
    return {
      badge: t('status.verification.REQUIRES_REVIEW'),
      tone: 'warning',
      note: t('home.verificationInProgress'),
    };
  }
  return {
    badge: t('status.verification.UNVERIFIED'),
    tone: 'clinical',
    note: t('home.verifyBloodType'),
  };
}
