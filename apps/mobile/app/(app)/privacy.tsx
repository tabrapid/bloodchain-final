import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Download, UserX } from 'lucide-react-native';
import {
  Banner,
  ListGroup,
  ListRow,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Stack,
  Surface,
  Text,
  Toggle,
  space,
} from '../../src/design';
import { useDonorProfile, useUpdateDonorProfile } from '../../src/hooks/useDonors';
import {
  useGamificationProfile,
  useUpdateLeaderboardVisibility,
} from '../../src/hooks/useGamification';
import { useTranslation } from '../../src/i18n';
import { policyLinks } from '../../src/config/links';

/**
 * When the policy text this screen points at was last revised. A date, not a
 * spelled-out month, so the label reads in the reader's language.
 */
const LAST_UPDATED = new Date(2026, 8, 1);

/**
 * Privacy, rebuilt for V2 — and still refusing to pretend.
 *
 * The reference shows five toggles. Three of them (public profile, donation
 * history visibility, anonymised analytics) have no field behind them anywhere
 * in this system, and a privacy switch that silently does nothing is worse than
 * one that is absent. Only the consent this app actually stores and honours is
 * offered.
 *
 * The fourth, leaderboard opt-out, turned out to be real: the column exists,
 * the leaderboard query has always honoured it, and the setter has always been
 * there -- but the profile endpoint did not return it, so the switch could not
 * be drawn in the position the donor left it, and an earlier reading of this
 * screen concluded there was nothing behind it. The endpoint returns it now
 * (S11.1), and a donor can take their name off a public ranking here.
 *
 * The same rule applies to the rows below it. There is no data-export endpoint
 * in this backend, so that row says so and is visibly, announced-ly disabled
 * rather than a tappable thing that does nothing. Account deletion exists
 * (DELETE /users/me) and the row leads to the screen that spells out what it
 * does before offering it. The policy rows open the published pages when this
 * build was given their addresses, and say "not yet published" otherwise.
 */
export default function Privacy() {
  const { t, formatMonth } = useTranslation();
  const { data: donorProfile } = useDonorProfile();
  const updateDonorProfile = useUpdateDonorProfile();
  const { data: gamificationProfile } = useGamificationProfile();
  const updateLeaderboardVisibility = useUpdateLeaderboardVisibility();
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null);
  const [pendingLeaderboard, setPendingLeaderboard] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consentLocation = pendingConsent ?? donorProfile?.consentLocation ?? false;
  const onLeaderboard = pendingLeaderboard ?? gamificationProfile?.leaderboardVisibility ?? true;

  const handleToggleLocation = (value: boolean) => {
    setError(null);
    setPendingConsent(value);
    updateDonorProfile.mutate(
      { consentLocation: value },
      {
        // The switch goes back to what the server actually holds, and the
        // failure is said on the screen rather than in a system dialog.
        onError: () => {
          setPendingConsent(null);
          setError(t('privacy.consentUpdateFailed'));
        },
        onSuccess: () => setPendingConsent(null),
      },
    );
  };

  const handleToggleLeaderboard = (value: boolean) => {
    setError(null);
    setPendingLeaderboard(value);
    updateLeaderboardVisibility.mutate(value, {
      onError: () => {
        setPendingLeaderboard(null);
        setError(t('privacy.leaderboardUpdateFailed'));
      },
      onSuccess: () => setPendingLeaderboard(null),
    });
  };

  const version = Constants.expoConfig?.version ?? '—';
  const { privacyPolicyUrl, termsUrl } = policyLinks();

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('privacy.title')}
          size="large"
          subtitle={t('privacy.subtitle')}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        {error ? <Banner tone="critical" title={error} /> : null}

        <Stack gap="md">
          <SectionHeader title={t('privacy.locationAndData')} />
          <Surface level="flat" padded={false}>
            <View style={{ paddingHorizontal: space.lg }}>
              <Toggle
                label={t('privacy.shareLocation')}
                description={t('privacy.shareLocationHint')}
                value={consentLocation}
                onValueChange={handleToggleLocation}
                busy={updateDonorProfile.isPending}
              />
              <Toggle
                label={t('privacy.leaderboardVisible')}
                description={t('privacy.leaderboardVisibleHint')}
                value={onLeaderboard}
                onValueChange={handleToggleLeaderboard}
                busy={updateLeaderboardVisibility.isPending}
              />
            </View>
          </Surface>
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('privacy.yourData')} />
          <ListGroup
            rows={[
              <ListRow
                key="download"
                icon={({ size, color }) => <Download size={size} color={color} />}
                title={t('privacy.downloadData')}
                subtitle={t('privacy.downloadDataHint')}
                disabled
              />,
              <ListRow
                key="delete"
                icon={({ size, color }) => <UserX size={size} color={color} />}
                tone="critical"
                title={t('privacy.deleteAccount')}
                subtitle={t('privacy.deleteAccountHint')}
                onPress={() => router.push('/delete-account')}
              />,
            ]}
          />
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('privacy.policies')} />
          <ListGroup
            rows={[
              <ListRow
                key="policy"
                title={t('privacy.privacyPolicy')}
                subtitle={privacyPolicyUrl ? t('privacy.opensInBrowser') : t('privacy.notPublished')}
                onPress={privacyPolicyUrl ? () => void Linking.openURL(privacyPolicyUrl) : undefined}
                disabled={!privacyPolicyUrl}
              />,
              <ListRow
                key="terms"
                title={t('privacy.termsOfService')}
                subtitle={termsUrl ? t('privacy.opensInBrowser') : t('privacy.notPublished')}
                onPress={termsUrl ? () => void Linking.openURL(termsUrl) : undefined}
                disabled={!termsUrl}
              />,
              <ListRow
                key="medical"
                title={t('privacy.medicalDisclaimer')}
                subtitle={t('privacy.medicalDisclaimerHint')}
                disabled
              />,
            ]}
          />
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('privacy.about')} />
          <ListGroup
            rows={[
              <ListRow key="version" title={t('privacy.version')} value={version} />,
              <ListRow
                key="updated"
                title={t('privacy.lastUpdated')}
                value={formatMonth(LAST_UPDATED)}
              />,
            ]}
          />
        </Stack>

        <Text variant="caption" tone="tertiary" align="center">
          {t('privacy.disclaimer')}
        </Text>
      </Stack>
    </ScrollScreen>
  );
}
