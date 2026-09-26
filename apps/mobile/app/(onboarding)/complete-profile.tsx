import { useEffect, useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  CheckCircle2,
  Droplet,
  HeartHandshake,
  Info,
  MapPin,
  UserRound,
  X,
} from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  Field,
  FormScreen,
  ListGroup,
  ListRow,
  OptionGrid,
  PermissionExplainer,
  PhoneField,
  Progress,
  Row,
  ScreenHeader,
  Stack,
  Surface,
  Text,
  Toggle,
  Well,
  iconSize,
  space,
  useDesign,
  IconButton,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useUpdateDonorProfile } from '../../src/hooks/useDonors';
import { useUpdateUserProfile } from '../../src/hooks/useUsers';
import { useUpdateNotificationPreferences } from '../../src/hooks/useNotifications';
import { pushConfig } from '../../src/notifications/push-config';
import { registerForPushNotificationsAsync } from '../../src/notifications/push';
import { useAuthStore } from '../../src/stores/auth.store';
import { ApiRequestError } from '../../src/api/client';
import { normalizePhone } from '@bloodchain/validation';
import { useTranslation } from '../../src/i18n';

/**
 * Each step's icon and its two catalogue keys live here rather than inside the
 * six branches of the switch, so the header renders them once and every step
 * is guaranteed the same anatomy: badge, headline, explanation, controls.
 *
 * Keys, not words: this list is built at module load, where there is no locale
 * yet, so the headline is resolved in the component below.
 */
const STEPS: { icon: LucideIcon; titleKey: string; subtitleKey: string }[] = [
  { icon: HeartHandshake, titleKey: 'onboarding.welcomeTitle', subtitleKey: 'onboarding.welcomeSubtitle' },
  { icon: UserRound, titleKey: 'onboarding.nameTitle', subtitleKey: 'onboarding.nameSubtitle' },
  { icon: Droplet, titleKey: 'onboarding.bloodTypeTitle', subtitleKey: 'onboarding.bloodTypeSubtitle' },
  { icon: MapPin, titleKey: 'onboarding.locationTitle', subtitleKey: 'onboarding.locationSubtitle' },
  { icon: Bell, titleKey: 'onboarding.notificationsTitle', subtitleKey: 'onboarding.notificationsSubtitle' },
  { icon: CheckCircle2, titleKey: 'onboarding.reviewTitle', subtitleKey: 'onboarding.reviewSubtitle' },
];

/**
 * The eight types a donor actually picks between. The previous flow asked for
 * the ABO group and the Rh factor as two separate questions, which is how a
 * blood type is *stored*, not how anyone knows their own -- people know "A-",
 * not "A, negative".
 */
const BLOOD_TYPES: { label: string; type: string; rh: string }[] = [
  { label: 'A+', type: 'A', rh: 'POSITIVE' },
  { label: 'A-', type: 'A', rh: 'NEGATIVE' },
  { label: 'B+', type: 'B', rh: 'POSITIVE' },
  { label: 'B-', type: 'B', rh: 'NEGATIVE' },
  { label: 'O+', type: 'O', rh: 'POSITIVE' },
  { label: 'O-', type: 'O', rh: 'NEGATIVE' },
  { label: 'AB+', type: 'AB', rh: 'POSITIVE' },
  { label: 'AB-', type: 'AB', rh: 'NEGATIVE' },
];

/** What the donor has decided about an operating-system permission. */
type Consent = 'unasked' | 'granted' | 'declined' | 'blocked';

/**
 * Onboarding, rebuilt for V2 — and the one screen in the app where the shape
 * of the interface is a promise about permissions.
 *
 * V1 asked the operating system for location the instant the donor tapped a
 * toggle labelled "Share precise location / OFF", and explained itself only
 * afterwards, in an `Alert` that appeared when the request was refused. On iOS
 * that is the only chance the app ever gets: the prompt does not come back.
 *
 * V2 explains first, every time, in a sheet where there is room to say what is
 * collected, who sees it and what the app will not do -- and where "Not now"
 * is the same size as "Allow" and costs the donor nothing. Nothing is asked of
 * the operating system until the donor has read that and chosen.
 *
 * The same rule now covers notifications, which V1 asked for on a completely
 * different screen: `usePushNotifications` fired
 * `Notifications.requestPermissionsAsync()` the moment authentication
 * succeeded, before the donor had seen a single word about what would be sent.
 * Registration no longer requests -- it only registers a device that has
 * already granted -- and the asking happens here, after the donor has chosen
 * which four kinds of message they want.
 */
export default function OnboardingWelcome() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const queryClient = useQueryClient();
  const updateDonorProfile = useUpdateDonorProfile();
  const updateUserProfile = useUpdateUserProfile();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const setNeedsOnboarding = useAuthStore((s) => s.setNeedsOnboarding);

  const [currentStep, setCurrentStep] = useState(0);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState<Consent>('unasked');
  const [explaining, setExplaining] = useState<'location' | 'notifications' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [notificationConsent, setNotificationConsent] = useState<Consent>('unasked');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bloodType: '',
    rhFactor: '',
    city: '',
    district: '',
    consentLocation: false,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    emergencyRequests: true,
    appointments: true,
    donationReminders: true,
    system: true,
  });

  const updateField = (field: string, value: string | boolean | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Turning it off is the donor's own decision and needs nothing explained. */
  const stopSharingLocation = () => {
    updateField('consentLocation', false);
    updateField('latitude', undefined);
    updateField('longitude', undefined);
    setLocationConsent('declined');
  };

  /** Only ever reached from the explainer's Allow button. */
  const askOperatingSystemForLocation = async () => {
    setExplaining(null);
    setLocationFailed(false);
    setIsLocating(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationConsent(canAskAgain ? 'declined' : 'blocked');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationConsent('granted');
      setFormData((prev) => ({
        ...prev,
        consentLocation: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
    } catch {
      // Granted, but the fix failed -- a different fact from refusing, and the
      // donor can try again without another trip through the OS.
      setLocationFailed(true);
    } finally {
      setIsLocating(false);
    }
  };

  /** Only ever reached from the explainer's Allow button. */
  const askOperatingSystemForNotifications = async () => {
    setExplaining(null);
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setNotificationConsent('granted');
      // The device can only be registered once the OS has said yes.
      void registerForPushNotificationsAsync();
      return;
    }
    setNotificationConsent(canAskAgain ? 'declined' : 'blocked');
  };

  const handleFinish = async () => {
    setFinishError(null);
    try {
      await updateUserProfile.mutateAsync({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone ? normalizePhone(`+998${formData.phone}`) ?? undefined : undefined,
      });

      await updateDonorProfile.mutateAsync({
        bloodType: (formData.bloodType as never) || undefined,
        rhFactor: (formData.rhFactor as never) || undefined,
        city: formData.city || undefined,
        district: formData.district || undefined,
        consentLocation: formData.consentLocation,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });

      await updateNotificationPreferences.mutateAsync({
        emergencyRequests: formData.emergencyRequests,
        appointments: formData.appointments,
        donationReminders: formData.donationReminders,
        system: formData.system,
      });

      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['donor-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      await queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });

      setNeedsOnboarding(false);
      router.replace('/(app)/home');
    } catch (error) {
      setFinishError(
        error instanceof ApiRequestError ? error.error.message : t('onboarding.saveFailed'),
      );
    }
  };

  /**
   * A way out of the wizard.
   *
   * Step one had a header containing nothing but "STEP 1 OF 6" -- no back, no
   * close -- and the screen is pushed from the Home and Profile completion
   * cards, so a donor who opened it to look had no way back to what they were
   * doing except finishing six steps or killing the app.
   */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/home');
  };

  const closeButton = (
    <IconButton
      accessibilityLabel={t('onboarding.closeWizard')}
      onPress={leave}
      variant="plain"
      icon={({ size, color }) => <X size={size} color={color} />}
    />
  );

  /**
   * Android's own back gesture, stepping rather than leaving.
   *
   * The six steps are component state, not routes, so the system back button
   * popped the whole screen -- from step 6, with five steps of answers in it.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStep > 0) {
        setCurrentStep((step) => step - 1);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [currentStep]);

  const canProceed = () => {
    if (currentStep === 1) return Boolean(formData.firstName.trim() && formData.lastName.trim());
    return true;
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isSaving =
    updateUserProfile.isPending ||
    updateDonorProfile.isPending ||
    updateNotificationPreferences.isPending;

  const step = STEPS[currentStep]!;
  const StepIcon = step.icon;

  const selectedBloodType =
    BLOOD_TYPES.find((entry) => entry.type === formData.bloodType && entry.rh === formData.rhFactor)
      ?.label ?? null;

  return (
    <FormScreen
      header={
        currentStep > 0 ? (
          <ScreenHeader
            eyebrow={t('onboarding.stepOf', { current: currentStep + 1, total: STEPS.length })}
            onBack={() => setCurrentStep(currentStep - 1)}
            backLabel={t('onboarding.previousStep')}
            actions={closeButton}
          />
        ) : (
          <ScreenHeader
            eyebrow={t('onboarding.stepOf', { current: currentStep + 1, total: STEPS.length })}
            actions={closeButton}
          />
        )
      }
    >
      <Stack gap="xl" style={{ flex: 1 }}>
        <Progress
          label={t(step.titleKey)}
          caption={t('onboarding.stepOf', { current: currentStep + 1, total: STEPS.length })}
          value={(currentStep + 1) / STEPS.length}
          bare
        />

        <Row gap="md" align="flex-start">
          <StepIcon size={iconSize.lg} color={colors.rose.base} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="h1" accessibilityRole="header">
              {t(step.titleKey)}
            </Text>
            <Text variant="body" tone="secondary">
              {t(step.subtitleKey)}
            </Text>
          </View>
        </Row>

        {/* ------------------------------------------------ what each step asks */}
        {currentStep === 0 ? (
          <ListGroup
            rows={[
              <ListRow key="history" title={t('onboarding.featureHistory')} />,
              <ListRow key="emergencies" title={t('onboarding.featureEmergencies')} />,
              <ListRow key="booking" title={t('onboarding.featureBooking')} />,
              <ListRow key="records" title={t('onboarding.featureRecords')} />,
            ]}
          />
        ) : null}

        {currentStep === 1 ? (
          <Stack gap="lg">
            <Field
              label={t('onboarding.firstName')}
              placeholder={t('auth.register.firstNamePlaceholder')}
              value={formData.firstName}
              onChangeText={(v) => updateField('firstName', v)}
              autoComplete="given-name"
              textContentType="givenName"
            />
            <Field
              label={t('onboarding.lastName')}
              placeholder={t('auth.register.lastNamePlaceholder')}
              value={formData.lastName}
              onChangeText={(v) => updateField('lastName', v)}
              autoComplete="family-name"
              textContentType="familyName"
            />
            {/* Digits only, with the prefix drawn rather than typed: a donor
                who has to type +998 is a donor who can type it wrong, and who
                then sees their own number rejected without being told which
                part was the problem. */}
            <PhoneField
              prefix="+998"
              label={t('onboarding.phoneOptional')}
              placeholder={t('auth.phone.placeholder')}
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v.replace(/\D/g, ''))}
            />
          </Stack>
        ) : null}

        {currentStep === 2 ? (
          <Stack gap="lg">
            <OptionGrid
              accessibilityLabel={t('medical.bloodGroup')}
              columns={4}
              value={selectedBloodType}
              onChange={(label) => {
                const entry = BLOOD_TYPES.find((candidate) => candidate.label === label)!;
                updateField('bloodType', entry.type);
                updateField('rhFactor', entry.rh);
              }}
              options={BLOOD_TYPES.map((entry) => ({
                value: entry.label,
                label: entry.label,
                accessibilityLabel: t('onboarding.a11yBloodType', { type: entry.label }),
              }))}
            />
            <Well>
              <Row gap="sm" align="flex-start">
                <Info size={iconSize.sm} color={colors.clinical.base} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {t('medical.verification.notSureSkip')}
                </Text>
              </Row>
            </Well>
          </Stack>
        ) : null}

        {currentStep === 3 ? (
          <Stack gap="lg">
            <Field
              label={t('onboarding.city')}
              placeholder={t('onboarding.cityPlaceholder')}
              value={formData.city}
              onChangeText={(v) => updateField('city', v)}
            />
            <Field
              label={t('onboarding.district')}
              placeholder={t('onboarding.districtPlaceholder')}
              value={formData.district}
              onChangeText={(v) => updateField('district', v)}
            />

            <Surface>
              <Stack gap="md">
                <Row gap="md" align="flex-start">
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{t('onboarding.sharePreciseLocation')}</Text>
                    <Text variant="caption" tone="secondary">
                      {t('onboarding.sharePreciseLocationHint')}
                    </Text>
                  </View>
                  {formData.consentLocation ? <Badge label={t('onboarding.on')} tone="success" /> : null}
                </Row>

                {/* The button says what pressing it does. V1's said "OFF",
                    which is a state, and pressing it went straight to the
                    operating system. */}
                {formData.consentLocation ? (
                  <Button
                    label={t('onboarding.stopSharingLocation')}
                    variant="secondary"
                    size="md"
                    onPress={stopSharingLocation}
                  />
                ) : (
                  <Button
                    label={t('onboarding.explainLocation')}
                    variant="secondary"
                    size="md"
                    loading={isLocating}
                    onPress={() => setExplaining('location')}
                  />
                )}

                {locationConsent === 'blocked' ? (
                  <Banner
                    tone="warning"
                    title={t('onboarding.locationBlockedTitle')}
                    description={t('onboarding.locationBlockedBody')}
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
                ) : null}

                {locationFailed ? (
                  <Banner
                    tone="warning"
                    title={t('onboarding.locationFailedTitle')}
                    description={t('onboarding.locationFailedBody')}
                  />
                ) : null}
              </Stack>
            </Surface>
          </Stack>
        ) : null}

        {currentStep === 4 ? (
          <Stack gap="lg">
            <Surface padded={false}>
              <View style={{ paddingHorizontal: space.lg }}>
                <Toggle
                  label={t('onboarding.notifyEmergencies')}
                  description={t('onboarding.notifyEmergenciesHint')}
                  value={formData.emergencyRequests}
                  onValueChange={(v) => updateField('emergencyRequests', v)}
                />
                <Toggle
                  label={t('onboarding.notifyAppointments')}
                  description={t('onboarding.notifyAppointmentsHint')}
                  value={formData.appointments}
                  onValueChange={(v) => updateField('appointments', v)}
                />
                <Toggle
                  label={t('onboarding.notifyDonations')}
                  description={t('onboarding.notifyDonationsHint')}
                  value={formData.donationReminders}
                  onValueChange={(v) => updateField('donationReminders', v)}
                />
                <Toggle
                  label={t('onboarding.notifySystem')}
                  description={t('onboarding.notifySystemHint')}
                  value={formData.system}
                  onValueChange={(v) => updateField('system', v)}
                />
              </View>
            </Surface>

            {/* The categories above are the app's own preferences and are saved
                either way. This is the separate question of whether the phone
                will show any of them at all. */}
            {notificationConsent === 'granted' && !pushConfig.configured && !pushConfig.expected ? (
              /*
                The phone said yes and the app still cannot deliver anything.
                Telling a donor "notifications are on" here would be the same
                untruth the settings screen used to tell, on the screen that
                actually asks them -- and the categories above include
                emergency requests.
              */
              <Banner
                tone="warning"
                title={t('notificationSettings.unavailableTitle')}
                description={t('notificationSettings.unavailableBody')}
              />
            ) : notificationConsent === 'granted' ? (
              <Banner tone="success" title={t('onboarding.notificationsAllowed')} />
            ) : notificationConsent === 'blocked' ? (
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
                  <Text variant="caption" tone="secondary">
                    {t('onboarding.notificationsPermissionNote')}
                  </Text>
                  <Button
                    label={t('onboarding.explainNotifications')}
                    variant="secondary"
                    size="md"
                    onPress={() => setExplaining('notifications')}
                  />
                </Stack>
              </Surface>
            )}
          </Stack>
        ) : null}

        {currentStep === 5 ? (
          <ListGroup
            rows={[
              <ListRow
                key="name"
                title={t('onboarding.reviewName')}
                value={`${formData.firstName} ${formData.lastName}`.trim() || t('onboarding.notProvided')}
              />,
              <ListRow
                key="phone"
                title={t('onboarding.reviewPhone')}
                value={formData.phone ? `+998 ${formData.phone}` : t('onboarding.notProvided')}
              />,
              <ListRow
                key="blood"
                title={t('medical.bloodGroup')}
                value={selectedBloodType ?? t('onboarding.notProvided')}
              />,
              <ListRow
                key="location"
                title={t('onboarding.reviewLocation')}
                value={formData.city || t('onboarding.notProvided')}
              />,
              <ListRow
                key="precise"
                title={t('onboarding.reviewPreciseLocation')}
                value={t(formData.consentLocation ? 'onboarding.on' : 'onboarding.off')}
              />,
            ]}
          />
        ) : null}

        {finishError ? <Banner tone="critical" title={finishError} /> : null}

        {/*
          The action sits at the foot of the screen, not under the content.

          Inside the scroller it landed at a different height on every one of
          the six steps -- mid-screen on the short ones, with a third of the
          page empty beneath it, and below the fold on the two that ask for
          typing. A spacer that can grow puts it in the same place each time,
          and the six steps stop feeling like six different screens.
        */}
        <View style={{ flex: 1, minHeight: space.lg }} />

        <Button
          label={t(isLastStep ? 'onboarding.completeSetup' : 'onboarding.continue')}
          disabled={!canProceed()}
          loading={isSaving}
          onPress={() => (isLastStep ? void handleFinish() : setCurrentStep(currentStep + 1))}
        />
      </Stack>

      <PermissionExplainer
        visible={explaining === 'location'}
        title={t('onboarding.locationExplainerTitle')}
        description={t('onboarding.locationExplainerBody')}
        assurances={[
          t('onboarding.locationAssuranceNearest'),
          t('onboarding.locationAssuranceNotTracked'),
          t('onboarding.locationAssuranceOptional'),
        ]}
        allowLabel={t('onboarding.locationAllow')}
        denyLabel={t('sos.locationNotNow')}
        onAllow={() => void askOperatingSystemForLocation()}
        onDeny={() => {
          setExplaining(null);
          setLocationConsent('declined');
        }}
        icon={({ size, color }) => <MapPin size={size} color={color} />}
      />

      <PermissionExplainer
        visible={explaining === 'notifications'}
        title={t('onboarding.notificationsExplainerTitle')}
        description={t('onboarding.notificationsExplainerBody')}
        assurances={[
          t('onboarding.notificationsAssuranceCategories'),
          t('onboarding.notificationsAssuranceNoMarketing'),
          t('onboarding.notificationsAssuranceChangeLater'),
        ]}
        allowLabel={t('onboarding.notificationsAllow')}
        denyLabel={t('sos.locationNotNow')}
        onAllow={() => void askOperatingSystemForNotifications()}
        onDeny={() => {
          setExplaining(null);
          setNotificationConsent('declined');
        }}
        icon={({ size, color }) => <Bell size={size} color={color} />}
      />
    </FormScreen>
  );
}
