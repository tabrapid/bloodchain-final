import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Bell } from 'lucide-react-native';
import {
  Banner,
  Button,
  ErrorState,
  PermissionExplainer,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  Toggle,
  space,
} from '../../src/design';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/hooks/useNotifications';
import { registerForPushNotificationsAsync } from '../../src/notifications/push';
import { pushConfig } from '../../src/notifications/push-config';
import type { NotificationPreferences } from '../../src/api/notifications';
import { useTranslation } from '../../src/i18n';

/**
 * The switches a donor was shown once and could never reach again.
 *
 * Onboarding asks about four notification categories and writes them with
 * `PATCH /notifications/preferences`; nothing in the app ever read them back or
 * offered to change them. Someone who declined emergency alerts on the day they
 * signed up had no way to change their mind, and the delivery service honours
 * these settings -- so the app was quietly silent for them with no visible
 * cause.
 *
 * Only the categories this donor can actually receive are listed. Shipment and
 * inventory notifications exist in the same preference row but are routed to
 * staff, so a donor toggle for them would control nothing.
 */
type DonorCategory = keyof Pick<
  NotificationPreferences,
  'emergencyRequests' | 'appointments' | 'donationReminders' | 'healthResults' | 'gamification' | 'system'
>;

const CATEGORIES: Array<{ key: DonorCategory; labelKey: string; hintKey: string }> = [
  { key: 'emergencyRequests', labelKey: 'notificationSettings.emergency', hintKey: 'notificationSettings.emergencyHint' },
  { key: 'appointments', labelKey: 'notificationSettings.appointments', hintKey: 'notificationSettings.appointmentsHint' },
  { key: 'donationReminders', labelKey: 'notificationSettings.reminders', hintKey: 'notificationSettings.remindersHint' },
  { key: 'healthResults', labelKey: 'notificationSettings.results', hintKey: 'notificationSettings.resultsHint' },
  { key: 'gamification', labelKey: 'notificationSettings.gamification', hintKey: 'notificationSettings.gamificationHint' },
  { key: 'system', labelKey: 'notificationSettings.system', hintKey: 'notificationSettings.systemHint' },
];

/** What the operating system currently allows. */
type DevicePermission = 'unknown' | 'granted' | 'askable' | 'blocked';

export default function NotificationSettings() {
  const { t } = useTranslation();

  const { data: preferences, isPending, isError } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  // The switch follows the finger immediately and falls back to the server's
  // answer if the write fails, rather than freezing until the round trip.
  const [pending, setPending] = useState<Partial<Record<DonorCategory, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DevicePermission>('unknown');
  const [explaining, setExplaining] = useState(false);

  /**
   * Whether the phone will show any of this at all.
   *
   * A donor who onboarded before S11, or who declined then, has no other way
   * back: registration no longer asks, precisely so that nothing asks without
   * explaining. This screen is where the explanation lives afterwards.
   */
  useEffect(() => {
    let cancelled = false;
    Notifications.getPermissionsAsync()
      .then(({ status, canAskAgain }) => {
        if (cancelled) return;
        setDevice(status === 'granted' ? 'granted' : canAskAgain ? 'askable' : 'blocked');
      })
      .catch(() => {
        if (!cancelled) setDevice('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Only ever reached from the explainer's Allow button. */
  const askOperatingSystem = async () => {
    setExplaining(false);
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setDevice('granted');
      void registerForPushNotificationsAsync();
      return;
    }
    setDevice(canAskAgain ? 'askable' : 'blocked');
  };

  const valueOf = (key: DonorCategory): boolean =>
    pending[key] ?? (preferences ? Boolean(preferences[key]) : false);

  const clearPending = (key: DonorCategory) =>
    setPending((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

  const toggle = (key: DonorCategory, value: boolean) => {
    setError(null);
    setPending((current) => ({ ...current, [key]: value }));
    updatePreferences.mutate(
      { [key]: value },
      {
        onError: () => {
          clearPending(key);
          setError(t('notificationSettings.updateFailed'));
        },
        onSuccess: () => clearPending(key),
      },
    );
  };

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('notificationSettings.title')}
          eyebrow={t('notificationSettings.subtitle')}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        {error ? <Banner tone="critical" title={error} /> : null}

        {/*
          The build itself, before anything about this phone.

          Every switch below is real and is honoured by the delivery service --
          but only if the build can receive a notification at all, and this one
          cannot: there is no Expo project for this product yet. The screen used
          to show six enabled toggles and a green "allowed" over a build where
          nothing could ever arrive, which is the app telling a donor they will
          be alerted to an emergency when they will not.

          A development build is not nagged about it: nobody expects push on a
          laptop.
        */}
        {!pushConfig.configured && !pushConfig.expected ? (
          <Banner
            tone="warning"
            title={t('notificationSettings.unavailableTitle')}
            description={t('notificationSettings.unavailableBody')}
          />
        ) : null}

        {/* ------------------------------------------- the phone's own switch */}
        {device !== 'unknown' && device !== 'granted' ? (
          <Stack gap="md">
            <SectionHeader title={t('notificationSettings.deviceSection')} />
            {device === 'blocked' ? (
              <Banner
                tone="warning"
                title={t('onboarding.notificationsBlockedTitle')}
                description={t('onboarding.notificationsBlockedBody')}
                action={
                  <Button
                    label={t('sos.locationDeniedOpenSettings')}
                    variant="secondary"
                    size="md"
                    block={false}
                    onPress={() => void Linking.openSettings()}
                  />
                }
              />
            ) : (
              <Surface>
                <Stack gap="md">
                  <Text variant="body" tone="secondary">
                    {t('notificationSettings.notAllowedYet')}
                  </Text>
                  <Button
                    label={t('onboarding.explainNotifications')}
                    variant="secondary"
                    size="md"
                    onPress={() => setExplaining(true)}
                  />
                </Stack>
              </Surface>
            )}
          </Stack>
        ) : null}

        {/* ----------------------------------------------- what you receive */}
        {isPending ? (
          <Stack gap="md">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </Stack>
        ) : isError || !preferences ? (
          <ErrorState
            title={t('notificationSettings.loadFailed')}
            description={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => router.replace('/(app)/notification-settings')}
          />
        ) : (
          <Stack gap="md">
            <SectionHeader title={t('notificationSettings.whatYouReceive')} />
            <Surface padded={false}>
              <View style={{ paddingHorizontal: space.lg }}>
                {CATEGORIES.map((category) => (
                  <Toggle
                    key={category.key}
                    label={t(category.labelKey)}
                    description={t(category.hintKey)}
                    value={valueOf(category.key)}
                    onValueChange={(value) => toggle(category.key, value)}
                    busy={updatePreferences.isPending}
                  />
                ))}
              </View>
            </Surface>

            {/* Said out loud because it is a real exception in the delivery
                service, not a reassurance: an emergency override reaches the
                donor during quiet hours. */}
            <Text variant="caption" tone="tertiary">
              {t('notificationSettings.emergencyNote')}
            </Text>
          </Stack>
        )}
      </Stack>

      <PermissionExplainer
        visible={explaining}
        title={t('onboarding.notificationsExplainerTitle')}
        description={t('onboarding.notificationsExplainerBody')}
        assurances={[
          t('onboarding.notificationsAssuranceCategories'),
          t('onboarding.notificationsAssuranceNoMarketing'),
          t('onboarding.notificationsAssuranceChangeLater'),
        ]}
        allowLabel={t('onboarding.notificationsAllow')}
        denyLabel={t('sos.locationNotNow')}
        onAllow={() => void askOperatingSystem()}
        onDeny={() => setExplaining(false)}
        icon={({ size, color }) => <Bell size={size} color={color} />}
      />
    </ScrollScreen>
  );
}
