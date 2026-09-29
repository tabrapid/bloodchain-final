import { router } from 'expo-router';
import { View } from 'react-native';
import Constants from 'expo-constants';
import {
  Award,
  Bell,
  BellRing,
  Droplet,
  Languages,
  Lock,
  LogOut,
  PencilLine,
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
  ScreenTitle,
  ScrollScreen,
  Section,
  Sections,
  SegmentedControl,
  Stat,
  StatRow,
  Surface,
  Text,
  ValueText,
  iconSize,
  space,
  useDesign,
  type AccentName,
  Skeleton,
} from '../../src/design';
import { useLogout } from '../../src/hooks/useAuth';
import { percentAsFraction } from '../../src/utils/progress';
import { useUserProfile } from '../../src/hooks/useUsers';
import { useDonorProfile, useProfileCompletion } from '../../src/hooks/useDonors';
import { useGamificationProfile, useLevelProgress, useAchievements } from '../../src/hooks/useGamification';
import { useTranslation } from '../../src/i18n';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@bloodchain/i18n';
import { useState } from 'react';

/**
 * The fields the server reports as missing, as catalogue keys.
 *
 * A code with no entry here is left out rather than guessed at: the list is
 * the server's, and a new code should appear as a shorter list, not as an
 * untranslated one.
 */
const MISSING_FIELD_KEYS: Record<string, string> = {
  basic_identity: 'profile.missingFields.basicIdentity',
  contact_verified: 'profile.missingFields.contactVerified',
  blood_type_provided: 'profile.missingFields.bloodType',
  date_of_birth: 'profile.missingFields.dateOfBirth',
  location: 'profile.missingFields.location',
};

/**
 * Profile, composed for V4: an account screen, not a dashboard.
 *
 * Identity at the top -- name, contact, blood type, verification -- then a
 * quiet line of standing, then the account organised into groups of rows:
 * donor details, preferences, privacy and security. Every setting is a row;
 * nothing that is a destination is a card.
 */
export default function Profile() {
  const { colors } = useDesign();
  const { t, locale, setLocale } = useTranslation();
  const logout = useLogout();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const { data: user } = useUserProfile();
  const { data: donor, isPending: donorPending } = useDonorProfile();
  const { data: completionData } = useProfileCompletion();
  const { data: gamificationProfile } = useGamificationProfile();
  const { data: levelProgress } = useLevelProgress();
  const { data: achievements } = useAchievements();

  const completion = completionData;
  const unlockedCount = achievements?.unlocked.length ?? 0;
  const inProgressCount = achievements?.inProgress.length ?? 0;

  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || t('table.donor') : '—';
  const contact = user?.phone || user?.email;

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
      <Sections rhythm="major">
        <ScreenTitle title={t('profile.title')} />

        {/* ------------------------------------------------------- who you are */}
        <Surface padded="lg">
          <View style={{ gap: space.lg }}>
            <Row gap="lg" align="center">
              <Avatar name={fullName} size={64} ring={donorPending ? undefined : verificationTone} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3" numberOfLines={1}>
                  {fullName}
                </Text>
                {contact ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {contact}
                  </Text>
                ) : null}
                <View style={{ marginTop: space.xs }}>
                  {donorPending ? (
                    <Skeleton width={96} height={22} corner="full" />
                  ) : (
                    <Badge
                      label={t(`status.verification.${verificationStatus}`)}
                      tone={verificationTone}
                      dot
                    />
                  )}
                </View>
              </View>
              <View
                style={{ alignItems: 'flex-end' }}
                accessible
                accessibilityLabel={`${t('home.bloodTypeLabel')} ${bloodTypeDisplay}`}
              >
                <ValueText variant="value" style={{ color: colors.rose.text }}>
                  {bloodTypeDisplay}
                </ValueText>
                {donor?.bloodTypeSource ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {t(`medical.verificationSource.${donor.bloodTypeSource}`)}
                  </Text>
                ) : null}
              </View>
            </Row>

            <Button
              label={t('profile.editProfile')}
              variant="secondary"
              size="md"
              icon={({ size, color }) => <PencilLine size={size} color={color} />}
              onPress={() => router.push('/(app)/profile/edit')}
            />
          </View>
        </Surface>

        {/* ------------------------------------- what is left to fill in */}
        {completion && completion.percentage < 100 ? (
          <Surface
            level="flat"
            tone="clinical"
            onPress={() => router.push('/(onboarding)/complete-profile')}
            accessibilityLabel={`${t('profile.completion')} ${completion.percentage}%. ${missingLabels.join(', ')}`}
          >
            <View style={{ gap: space.md }}>
              <Progress
                label={t('profile.completion')}
                caption={`${completion.percentage}%`}
                value={completion.percentage / 100}
                tone="clinical"
                thickness="thin"
              />
              {missingLabels.length > 0 ? (
                <Text variant="caption" tone="secondary">
                  {t('profile.stillNeeded', { items: missingLabels.join(', ') })}
                </Text>
              ) : null}
            </View>
          </Surface>
        ) : null}

        {/* ------------------------------------------------- your standing */}
        {gamificationProfile ? (
          <View style={{ gap: space.md }}>
            <StatRow>
              <Stat
                label={t('profile.donations')}
                value={String(gamificationProfile.donationCount)}
                tone="rose"
                size="sm"
              />
              <Stat
                label={t('profile.emergencyResponses')}
                value={String(gamificationProfile.emergencyResponseCount)}
                size="sm"
              />
              <Stat label={t('profile.xp')} value={String(gamificationProfile.totalXp)} size="sm" />
            </StatRow>
            {levelProgress && !levelProgress.isMaxLevel ? (
              <View style={{ paddingHorizontal: space.xs }}>
                <Progress
                  label={`${levelProgress.currentLevelName} → ${levelProgress.nextLevelName}`}
                  caption={t('gamification.xpValue', { xp: levelProgress.xpToNextLevel })}
                  value={percentAsFraction(levelProgress.progress)}
                  thickness="thin"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* --------------------------------------------------- donor records */}
        <Section title={t('profile.donorInfo')}>
          <ListGroup
            rows={[
              <ListRow
                key="donor"
                icon={({ size, color }) => <Droplet size={size} color={color} />}
                iconTone="rose"
                title={t('profile.donorProfile')}
                subtitle={t('profile.donorProfileNote')}
                onPress={() => router.push('/(app)/profile/donor')}
              />,
              <ListRow
                key="personal"
                icon={({ size, color }) => <User size={size} color={color} />}
                iconTone="clinical"
                title={t('profile.personalInfo')}
                subtitle={t('profile.personalInfoNote')}
                onPress={() => router.push('/(app)/profile/edit')}
              />,
              <ListRow
                key="achievements"
                icon={({ size, color }) => <Award size={size} color={color} />}
                title={t('profile.achievements')}
                subtitle={[
                  t('profile.earnedCount', { count: unlockedCount }),
                  t('profile.inProgressCount', { count: inProgressCount }),
                ].join(' · ')}
                onPress={() => router.push('/(app)/gamification')}
              />,
            ]}
          />
        </Section>

        {/* ------------------------------------------------------- settings */}
        <Section title={t('profile.settings')}>
          {/* The language decides how every row below reads, so it belongs
              where it is seen first. */}
          <View style={{ gap: space.sm }}>
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
          </View>

          <ListGroup
            rows={[
              <ListRow
                key="notifications"
                icon={({ size, color }) => <Bell size={size} color={color} />}
                title={t('profile.notifications')}
                onPress={() => router.push('/(app)/notifications')}
              />,
              <ListRow
                key="notification-settings"
                icon={({ size, color }) => <BellRing size={size} color={color} />}
                title={t('notificationSettings.title')}
                onPress={() => router.push('/(app)/notification-settings')}
              />,
              <ListRow
                key="privacy"
                icon={({ size, color }) => <Lock size={size} color={color} />}
                title={t('profile.privacy')}
                onPress={() => router.push('/(app)/privacy')}
              />,
              <ListRow
                key="security"
                icon={({ size, color }) => <Shield size={size} color={color} />}
                title={t('profile.security')}
                onPress={() => router.push('/(app)/security')}
              />,
            ]}
          />
        </Section>

        {/* Signing out on a phone that is someone's only way back into an
            emergency response deserves the one question. */}
        <View style={{ gap: space.lg }}>
          <Button
            label={t('profile.signOut')}
            variant="secondary"
            accent="critical"
            icon={({ size, color }) => <LogOut size={size} color={color} />}
            onPress={() => setConfirmingSignOut(true)}
          />

          <Text variant="caption" tone="tertiary" align="center">
            {t('profile.versionStamp', { version, phase: t('profile.phase') })}
          </Text>
        </View>
      </Sections>

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
