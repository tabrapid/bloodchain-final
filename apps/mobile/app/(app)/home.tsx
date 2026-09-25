import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Droplet,
  FileText,
  Heart,
  Siren,
  UserRound,
} from 'lucide-react-native';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  EmergencyBanner,
  IconButton,
  ListGroup,
  ListRow,
  Progress,
  Row,
  ScrollScreen,
  SectionHeader,
  Stack,
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
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useDonorEmergencies } from '../../src/hooks/useEmergency';
import { useAuthStore } from '../../src/stores/auth.store';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

/**
 * Home, rebuilt for V2.
 *
 * The brief: make the donor's identity, eligibility, next appointment, the
 * urgent thing and their impact immediately legible -- and do NOT overload the
 * screen with every feature.
 *
 * V1 answered the first half and lost the second. It opened with a full-bleed
 * rose-to-violet hero carrying the blood type, a verification badge, a shield,
 * a location and three statistics; below it three more cards, a completion
 * card, an emergency card and a four-up grid of quick actions. Eleven distinct
 * surfaces, most of them shadowed, all competing. When everything is elevated,
 * nothing is.
 *
 * V2 keeps the same information and orders it by how urgent it is:
 *
 *   1. Who you are     -- greeting, blood type, verification. Quiet.
 *   2. What is urgent  -- the emergency line, and ONLY when there is one, in
 *                        the one red the app reserves for it.
 *   3. What is next    -- eligibility and the next appointment, as rows.
 *   4. What you have done -- three numbers, flat.
 *   5. Everything else -- a list, not a grid of tiles.
 *
 * The four quick actions were hardcoded English strings with literal newlines
 * in them (`'Schedule\nDonation'`) on a screen the app ships in Uzbek and
 * Russian. They are catalogue keys now, and rows rather than tiles, because a
 * two-word label in English is a five-word label in Russian and a tile cannot
 * grow.
 */
export default function Home() {
  const { colors } = useDesign();
  const { t, formatDayHeading, formatDate, formatTime } = useTranslation();
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
  const completionPercentage = completionData?.data?.percentage ?? 0;

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

  return (
    <ScrollScreen>
      <Stack gap="xl">
        {/* ------------------------------------------------- who you are */}
        <Row align="flex-start" gap="md" style={{ paddingTop: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" tone="tertiary">
              {formatDayHeading(new Date())}
            </Text>
            <Text variant="h1" numberOfLines={2}>
              {greeting}
            </Text>
          </View>
          <Row gap="xs">
            <View>
              <IconButton
                accessibilityLabel={
                  unreadCount?.count
                    ? `${t('profile.notifications')}, ${t('notifications.unreadCount', { count: unreadCount.count })}`
                    : t('profile.notifications')
                }
                onPress={() => router.push('/(app)/notifications')}
                icon={({ size, color }) => <Bell size={size} color={color} />}
              />
              {unreadCount?.count ? (
                <View
                  // Decorative: the count is already in the button's label, so
                  // announcing the dot as well says it twice.
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: radius.full,
                    backgroundColor: colors.critical.fill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" tone="onAccent" style={{ fontSize: 10, lineHeight: 13 }}>
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
              <Avatar name={fullName ?? user?.firstName ?? 'Donor'} size={40} />
            </Pressable>
          </Row>
        </Row>

        <Pressable
          onPress={() => router.push('/(app)/profile/donor')}
          accessibilityRole="button"
          accessibilityLabel={`${t('home.bloodTypeLabel')} ${bloodTypeDisplay}. ${verification.note}. ${t('home.verificationOpenProfile')}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Surface>
            <Row gap="lg">
              {/* The blood type is the donor's identity in this app, so it is
                  the largest thing on the screen -- but in rose on an ordinary
                  surface rather than white on a full-bleed gradient. */}
              <View style={{ alignItems: 'center', gap: 2 }}>
                <ValueText variant="hero" style={{ color: colors.rose.text }}>
                  {bloodTypeDisplay}
                </ValueText>
                <Text variant="overline" tone="tertiary" caps>
                  {t('home.bloodTypeLabel')}
                </Text>
              </View>

              <View style={{ flex: 1, gap: space.sm }}>
                <Badge label={verification.badge} tone={verification.tone} />
                <Text variant="caption" tone="secondary">
                  {verification.note}
                </Text>
                {location ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {location}
                  </Text>
                ) : null}
              </View>

              <ChevronRight size={iconSize.md} color={colors.textTertiary} />
            </Row>
          </Surface>
        </Pressable>

        {/* -------------------------------------------- what is urgent */}
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
                // It sits on the emergency fill, where `textPrimary` is
                // near-black in light mode and about 3.5:1 on that red.
                onAccent
                onPress={() => router.push('/sos')}
              />
            }
          />
        ) : null}

        {completionPercentage < 100 ? (
          <Pressable
            onPress={() => router.push('/(onboarding)/complete-profile')}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.completeProfile')}. ${completionPercentage}%`}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Surface>
              <Stack gap="md">
                <Row gap="md">
                  <UserRound size={iconSize.lg} color={colors.clinical.base} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{t('home.completeProfile')}</Text>
                    <Text variant="caption" tone="secondary">
                      {t('home.completeProfileBody')}
                    </Text>
                  </View>
                  <ChevronRight size={iconSize.md} color={colors.textTertiary} />
                </Row>
                <Progress
                  label={t('home.completeProfile')}
                  caption={`${completionPercentage}%`}
                  value={completionPercentage / 100}
                  tone="clinical"
                  bare
                />
              </Stack>
            </Surface>
          </Pressable>
        ) : null}

        {/* ---------------------------------------------- what is next */}
        <Stack gap="md">
          <SectionHeader title={t('home.nextAppointment')} />
          <ListGroup
            rows={[
              <ListRow
                key="eligibility"
                leading={
                  <CalendarCheck
                    size={iconSize.lg}
                    color={isEligible ? colors.success.base : colors.textTertiary}
                  />
                }
                title={t('home.eligibilityTitle')}
                subtitle={isEligible ? t('home.eligibleToday') : t('home.eligibilityOpensThen')}
                value={isEligible ? t('home.eligibleNow') : formatDate(nextEligible!, 'medium')}
                onPress={() => router.push('/(booking)/select-type')}
              />,
              <ListRow
                key="appointment"
                leading={<CalendarDays size={iconSize.lg} color={colors.clinical.base} />}
                title={
                  appointmentDate ? formatDate(appointmentDate, 'medium') : t('home.noAppointment')
                }
                subtitle={
                  appointmentDate
                    ? `${formatTime(appointmentDate)} · ${nextAppointment!.organization.name}`
                    : t('home.scheduleNext')
                }
                onPress={() =>
                  nextAppointment
                    ? router.push(`/appointment/${nextAppointment.id}`)
                    : router.push('/(booking)/select-type')
                }
              />,
            ]}
          />
        </Stack>

        {/* ------------------------------------------ what you have done */}
        <Stack gap="md">
          <SectionHeader title={t('home.impact')} />
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

          {levelProgress ? (
            <Surface>
              <Progress
                label={`${t('home.levelAndXp')} ${levelProgress.currentLevel}`}
                caption={`${levelProgress.currentXp} / ${levelProgress.xpForNextLevel} XP`}
                value={levelProgress.progress ?? 0}
                tone="insight"
              />
            </Surface>
          ) : null}
        </Stack>

        {/* ------------------------------------------------ everything else */}
        <Stack gap="md">
          <SectionHeader title={t('home.quickActions')} />
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
                tone="insight"
                label={t('home.quickActionLearn')}
                onPress={() => router.push('/education')}
              />,
            ]}
          />
        </Stack>

        {/* Kept last and quiet: when there is no emergency, saying so is
            reassurance, not news, and it does not belong above the fold. */}
        {activeEmergencyCount === 0 ? (
          <Banner
            tone="neutral"
            title={t('home.noEmergencies')}
            description={t('home.emergencyWillAlert')}
            icon={({ size, color }) => <Siren size={size} color={color} />}
          />
        ) : null}
      </Stack>
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
  const { colors } = useDesign();
  return (
    <ListRow
      title={label}
      leading={<Icon size={iconSize.lg} color={colors[tone].base} />}
      trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
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
      badge: t('home.verificationVerified'),
      tone: 'success',
      note: t('home.bloodTypeVerified'),
    };
  }
  if (status === 'REQUIRES_REVIEW') {
    return {
      badge: t('home.verificationUnderReview'),
      tone: 'warning',
      note: t('home.verificationInProgress'),
    };
  }
  return {
    badge: t('home.verificationUnverified'),
    tone: 'clinical',
    note: t('home.verifyBloodType'),
  };
}
