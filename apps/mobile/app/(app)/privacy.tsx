import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { MapPin } from 'lucide-react-native';
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
  iconSize,
  space,
  useDesign,
} from '../../src/design';
import { useDonorProfile, useUpdateDonorProfile } from '../../src/hooks/useDonors';
import { useTranslation } from '../../src/i18n';

/**
 * When the policy text this screen points at was last revised. A date, not a
 * spelled-out month, so the label reads in the reader's language.
 */
const LAST_UPDATED = new Date(2026, 8, 1);

/**
 * Privacy, rebuilt for V2 — and still refusing to pretend.
 *
 * The reference shows five toggles. Four of them (public profile, donation
 * history visibility, leaderboard opt-out, anonymised analytics) have no field
 * behind them anywhere in this system, and a privacy switch that silently does
 * nothing is worse than one that is absent. Only the consent this app actually
 * stores and honours is offered.
 *
 * The same rule applies to the rows below it. There is no data-export endpoint
 * and no self-service account deletion in this backend, so those rows say what
 * to do instead and are visibly, announced-ly disabled rather than tappable
 * things that do nothing. V1 rendered them as ordinary rows with no `onPress`,
 * which looks identical to a row whose handler is broken.
 */
export default function Privacy() {
  const { t, formatMonth } = useTranslation();
  const { colors } = useDesign();
  const { data: donorProfile } = useDonorProfile();
  const updateDonorProfile = useUpdateDonorProfile();
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consentLocation = pendingConsent ?? donorProfile?.consentLocation ?? false;

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

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('privacy.title')}
          eyebrow={t('privacy.subtitle')}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        {error ? <Banner tone="critical" title={error} /> : null}

        <Stack gap="md">
          <SectionHeader title={t('privacy.locationAndData')} />
          <Surface padded={false}>
            <View style={{ paddingHorizontal: space.lg }}>
              <Toggle
                label={t('privacy.shareLocation')}
                description={t('privacy.shareLocationHint')}
                value={consentLocation}
                onValueChange={handleToggleLocation}
                busy={updateDonorProfile.isPending}
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
                leading={<MapPin size={iconSize.lg} color={colors.textTertiary} />}
                title={t('privacy.downloadData')}
                subtitle={t('privacy.downloadDataHint')}
                disabled
              />,
              <ListRow
                key="delete"
                title={t('privacy.deleteAccount')}
                subtitle={t('privacy.deleteAccountHint')}
                disabled
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
                subtitle={t('privacy.notPublished')}
                disabled
              />,
              <ListRow
                key="terms"
                title={t('privacy.termsOfService')}
                subtitle={t('privacy.notPublished')}
                disabled
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
