import { router } from 'expo-router';
import { View } from 'react-native';
import Constants from 'expo-constants';
import {
  Award,
  Bell,
  BellRing,
  ChevronRight,
  Droplet,
  Languages,
  Lock,
  LogOut,
  Shield,
  User,
} from 'lucide-react-native';
import {
  Avatar,
  Badge,
  Button,
  ConfirmationSheet,
  ListGroup,
  ListRow,
  Progress,
  Row,
  ScrollScreen,
  SectionHeader,
  SegmentedControl,
  Stack,
  Stat,
  StatRow,
  Surface,
  Text,
  ValueText,
  iconSize,
  space,
  useDesign,
  type AccentName,
} from '../../src/design';
import { useLogout } from '../../src/hooks/useAuth';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile, useProfileCompletion } from '../../src/hooks/useDonors';
import { useGamificationProfile, useLevelProgress, useAchievements } from '../../src/hooks/useGamification';
import { useTranslation } from '../../src/i18n';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@bloodchain/i18n';
import { useState } from 'react';

/**
 * The fields the server reports as missing, as catalogue keys.
 *
 * V1 printed the raw codes with the underscores swapped for spaces --
 * "Missing: basic identity, contact verified, blood type provided" -- which is
 * a database column list shown to a donor. A code with no entry here is left
 * out rather than guessed at: the list is the server's, and a new code should
 * appear as a shorter list, not as an untranslated one.
 */
const MISSING_FIELD_KEYS: Record<string, string> = {
  basic_identity: 'profile.missingFields.basicIdentity',
  contact_verified: 'profile.missingFields.contactVerified',
  blood_type_provided: 'profile.missingFields.bloodType',
  date_of_birth: 'profile.missingFields.dateOfBirth',
  location: 'profile.missingFields.location',
};

/**
 * Profile, rebuilt for V2.
 *
 * V1 opened with an elevated glass card, then a teaser card, then a
 * green-to-blue gradient completion card, then a rose gradient blood-type card
 * with a 140pt watermark droplet behind it -- four competing heroes before the
 * first setting. Most of a profile screen is a list of destinations, and a list
 * is what it is now: identity and standing at the top, then rows.
 *
 * Five strings here were English literals on a screen that ships in three
 * languages: 'Verified', 'Under Review', 'Verified Donor', `${type} Blood
 * Type`, and `${unlocked} earned · ${inProgress} in progress`. Two more were
 * raw database values printed straight to the donor: `Missing:
 * basic_identity, contact_verified` with the underscores swapped for spaces,
 * and `Source: BLOOD_CENTER`.
 *
 * And the version stamp read 0.2.0 while app.json said 0.1.0. It is read from
 * the manifest now, so the number a donor reads to support is the number that
 * was built.
 */
export default function Profile() {
  const { colors } = useDesign();
  const { t, locale, setLocale } = useTranslation();
  const logout = useLogout();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const { data: user } = useUserProfile();
  const { data: donor } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: levelProgress } = useLevelProgress();
  const { data: achievements } = useAchievements();

  const completion = completionData?.data;
  const unlockedCount = achievements?.unlocked.length ?? 0;
  const inProgressCount = achievements?.inProgress.length ?? 0;

  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Donor' : '—';

  const bloodTypeDisplay =
    donor?.bloodType && donor?.rhFactor
      ? `${donor.bloodType}${donor.rhFactor === 'POSITIVE' ? '+' : '-'}`
      : '—';

  const verificationStatus = donor?.verificationStatus ?? 'UNVERIFIED';
  const verificationTone: AccentName =
    verificationStatus === 'VERIFIED'
      ? 'success'
      : verificationStatus === 'REQUIRES_REVIEW'
        ? 'warning'
        : 'clinical';

  const missingLabels = (completion?.missing ?? [])
    .map((code) => MISSING_FIELD_KEYS[code])
    .filter((key): key is string => Boolean(key))
    .map((key) => t(key));

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollScreen>
      <Stack gap="xl">
        <View style={{ paddingTop: space.md }}>
          <Text variant="h1">{t('profile.title')}</Text>
        </View>

        {/* ------------------------------------------------------- who you are */}
        <Surface>
          <Stack gap="lg">
            <Row gap="lg">
              <Avatar name={fullName} size={56} ring={verificationTone} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3" numberOfLines={1}>
                  {fullName}
                </Text>
                {user?.email ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <ValueText variant="h1" style={{ color: colors.rose.text }}>
                  {bloodTypeDisplay}
                </ValueText>
                <Text variant="overline" tone="tertiary" caps>
                  {t('home.bloodTypeLabel')}
                </Text>
              </View>
            </Row>

            <Row gap="sm">
              <Badge
                label={t(`status.verification.${verificationStatus}`)}
                tone={verificationTone}
              />
              {/* Where the group came from is part of what "verified" means.
                  V1 printed the enum. */}
              {donor?.bloodTypeSource ? (
                <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
                  {t(`medical.verificationSource.${donor.bloodTypeSource}`)}
                </Text>
              ) : null}
            </Row>

            <Button
              label={t('profile.editProfile')}
              variant="secondary"
              size="md"
              onPress={() => router.push('/(app)/profile/edit')}
            />
          </Stack>
        </Surface>

        {/* ------------------------------------- what is left to fill in */}
        {completion && completion.percentage < 100 ? (
          <Surface
            onPress={() => router.push('/(onboarding)/complete-profile')}
            accessibilityLabel={`${t('profile.completion')} ${completion.percentage}%. ${missingLabels.join(', ')}`}
          >
            <Stack gap="md">
              <Progress
                label={t('profile.completion')}
                caption={`${completion.percentage}%`}
                value={completion.percentage / 100}
                tone="clinical"
              />
              {missingLabels.length > 0 ? (
                <Text variant="caption" tone="secondary">
                  {t('profile.stillNeeded', { items: missingLabels.join(', ') })}
                </Text>
              ) : null}
            </Stack>
          </Surface>
        ) : null}

        {/* ------------------------------------------------- what you have done */}
        {gamificationProfile ? (
          <Stack gap="md">
            <StatRow>
              <Stat
                label={t('profile.donations')}
                value={String(gamificationProfile.donationCount)}
                tone="rose"
              />
              <Stat
                label={t('profile.emergencyResponses')}
                value={String(gamificationProfile.emergencyResponseCount)}
              />
              <Stat label={t('profile.xp')} value={String(gamificationProfile.totalXp)} tone="insight" />
            </StatRow>

            {levelProgress && !levelProgress.isMaxLevel ? (
              <Surface>
                <Progress
                  label={`${levelProgress.currentLevelName} → ${levelProgress.nextLevelName}`}
                  caption={`${levelProgress.currentXp} / ${levelProgress.xpForNextLevel} ${t('profile.xp')}`}
                  value={levelProgress.progress}
                  tone="insight"
                />
              </Surface>
            ) : null}
          </Stack>
        ) : null}

        {/* --------------------------------------------------- donor records */}
        <Stack gap="md">
          <SectionHeader title={t('profile.donorInfo')} />
          <ListGroup
            rows={[
              <ListRow
                key="donor"
                leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
                title={t('profile.donorProfile')}
                subtitle={t('profile.donorProfileNote')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/profile/donor')}
              />,
              <ListRow
                key="personal"
                leading={<User size={iconSize.lg} color={colors.clinical.base} />}
                title={t('profile.personalInfo')}
                subtitle={t('profile.personalInfoNote')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/profile/edit')}
              />,
              <ListRow
                key="achievements"
                leading={<Award size={iconSize.lg} color={colors.warning.base} />}
                title={t('profile.achievements')}
                subtitle={[
                  t('profile.earnedCount', { count: unlockedCount }),
                  t('profile.inProgressCount', { count: inProgressCount }),
                ].join(' · ')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/gamification')}
              />,
            ]}
          />
        </Stack>

        {/* ------------------------------------------------------- settings */}
        <Stack gap="md">
          <SectionHeader title={t('profile.settings')} />

          {/* Above the settings list rather than inside it: the language
              decides how every row below reads, so it belongs where it is
              seen first. */}
          <Surface>
            <Stack gap="md">
              <Row gap="sm">
                <Languages size={iconSize.sm} color={colors.textTertiary} />
                <Text variant="label" tone="secondary">
                  {t('language.title')}
                </Text>
              </Row>
              <SegmentedControl<Locale>
                options={SUPPORTED_LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
                value={locale}
                onChange={setLocale}
                accessibilityLabel={t('language.title')}
              />
            </Stack>
          </Surface>

          <ListGroup
            rows={[
              <ListRow
                key="notifications"
                leading={<Bell size={iconSize.lg} color={colors.textSecondary} />}
                title={t('profile.notifications')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/notifications')}
              />,
              // Onboarding asked which notifications to send and nothing ever
              // offered to change the answer.
              <ListRow
                key="notification-settings"
                leading={<BellRing size={iconSize.lg} color={colors.textSecondary} />}
                title={t('notificationSettings.title')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/notification-settings')}
              />,
              <ListRow
                key="privacy"
                leading={<Lock size={iconSize.lg} color={colors.textSecondary} />}
                title={t('profile.privacy')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/privacy')}
              />,
              <ListRow
                key="security"
                leading={<Shield size={iconSize.lg} color={colors.textSecondary} />}
                title={t('profile.security')}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                onPress={() => router.push('/(app)/security')}
              />,
            ]}
          />
        </Stack>

        {/* Signing out on a phone that is someone's only way back into an
            emergency response deserves the one question. V1 signed out on the
            first tap. */}
        <Button
          label={t('profile.signOut')}
          variant="secondary"
          accent="critical"
          icon={({ size }) => <LogOut size={size} color={colors.critical.text} />}
          onPress={() => setConfirmingSignOut(true)}
          style={{ borderColor: colors.critical.base }}
        />

        <Text variant="caption" tone="tertiary" align="center">
          {t('profile.versionStamp', { version, phase: t('profile.phase') })}
        </Text>
      </Stack>

      <ConfirmationSheet
        visible={confirmingSignOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          logout.mutate();
        }}
        title={t('profile.signOut')}
        description={t('profile.signOutBody')}
        confirmLabel={t('profile.signOut')}
        cancelLabel={t('common.cancel')}
        busy={logout.isPending}
        destructive
      />
    </ScrollScreen>
  );
}
