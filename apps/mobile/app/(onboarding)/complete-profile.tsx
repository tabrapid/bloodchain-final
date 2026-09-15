import { useMemo, useState } from 'react';
import { Alert, Pressable, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Droplet,
  HeartHandshake,
  Info,
  MapPin,
  UserRound,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  AppTextInput,
  GlassCard,
  IconButton,
  Screen,
  StepRail,
} from '../../src/components';
import { LucideIcon } from '../../src/types/icons';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import { useUpdateDonorProfile } from '../../src/hooks/useDonors';
import { useUpdateUserProfile } from '../../src/hooks/useUsers';
import { useUpdateNotificationPreferences } from '../../src/hooks/useNotifications';
import { useAuthStore } from '../../src/stores/auth.store';
import { ApiRequestError } from '../../src/api/client';
import { useTranslation } from '../../src/i18n';

/**
 * Each step's icon and its two catalogue keys live here rather than inside the
 * six branches of `renderStep`, so the header renders them once and every step
 * is guaranteed the same anatomy: badge, headline, explanation, controls. The
 * branches are left with only the controls that differ.
 *
 * Keys, not words: this list is built at module load, where there is no locale
 * yet, so the headline is resolved in the component below.
 */
const STEPS: { icon: LucideIcon; titleKey: string; subtitleKey: string }[] = [
  {
    icon: HeartHandshake,
    titleKey: 'onboarding.welcomeTitle',
    subtitleKey: 'onboarding.welcomeSubtitle',
  },
  {
    icon: UserRound,
    titleKey: 'onboarding.nameTitle',
    subtitleKey: 'onboarding.nameSubtitle',
  },
  {
    icon: Droplet,
    titleKey: 'onboarding.bloodTypeTitle',
    subtitleKey: 'onboarding.bloodTypeSubtitle',
  },
  {
    icon: MapPin,
    titleKey: 'onboarding.locationTitle',
    subtitleKey: 'onboarding.locationSubtitle',
  },
  {
    icon: Bell,
    titleKey: 'onboarding.notificationsTitle',
    subtitleKey: 'onboarding.notificationsSubtitle',
  },
  {
    icon: CheckCircle2,
    titleKey: 'onboarding.reviewTitle',
    subtitleKey: 'onboarding.reviewSubtitle',
  },
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

export default function OnboardingWelcome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();
  const updateDonorProfile = useUpdateDonorProfile();
  const updateUserProfile = useUpdateUserProfile();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const setNeedsOnboarding = useAuthStore((s) => s.setNeedsOnboarding);
  const [finishError, setFinishError] = useState<string | null>(null);

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
  const [isLocating, setIsLocating] = useState(false);

  const updateField = (field: string, value: string | boolean | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleShareLocation = async () => {
    if (formData.consentLocation) {
      updateField('consentLocation', false);
      updateField('latitude', undefined);
      updateField('longitude', undefined);
      return;
    }

    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('onboarding.locationPermissionTitle'),
          t('onboarding.locationPermissionBody'),
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateField('consentLocation', true);
      updateField('latitude', position.coords.latitude);
      updateField('longitude', position.coords.longitude);
    } catch {
      Alert.alert(t('onboarding.locationFailedTitle'), t('onboarding.locationFailedBody'));
    } finally {
      setIsLocating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setFinishError(null);
    try {
      await updateUserProfile.mutateAsync({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
      });

      await updateDonorProfile.mutateAsync({
        bloodType: formData.bloodType as any || undefined,
        rhFactor: formData.rhFactor as any || undefined,
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
        error instanceof ApiRequestError
          ? error.error.message
          : t('onboarding.saveFailed'),
      );
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.featureList}>
              <FeatureItem text={t('onboarding.featureHistory')} />
              <FeatureItem text={t('onboarding.featureEmergencies')} />
              <FeatureItem text={t('onboarding.featureBooking')} />
              <FeatureItem text={t('onboarding.featureRecords')} />
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <AppTextInput
              label={t('onboarding.firstName')}
              placeholder={t('auth.register.firstNamePlaceholder')}
              wrapperStyle={styles.inputWrapper}
              value={formData.firstName}
              onChangeText={(v) => updateField('firstName', v)}
            />
            <AppTextInput
              label={t('onboarding.lastName')}
              placeholder={t('auth.register.lastNamePlaceholder')}
              wrapperStyle={styles.inputWrapper}
              value={formData.lastName}
              onChangeText={(v) => updateField('lastName', v)}
            />
            <AppTextInput
              label={t('onboarding.phoneOptional')}
              placeholder="+998 90 000 00 00"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v)}
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            {/* Two rows of four rather than one wrapping row: the pairs read
                as A / B / O / AB with their sign, which is how the grid is
                scanned, and no row can end up with a single orphan chip. */}
            {[BLOOD_TYPES.slice(0, 4), BLOOD_TYPES.slice(4)].map((row, index) => (
              <View key={index} style={styles.bloodTypeRow}>
                {row.map((entry) => (
                  <BloodTypeChip
                    key={entry.label}
                    label={entry.label}
                    selected={formData.bloodType === entry.type && formData.rhFactor === entry.rh}
                    onPress={() => {
                      updateField('bloodType', entry.type);
                      updateField('rhFactor', entry.rh);
                    }}
                  />
                ))}
              </View>
            ))}
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Info size={18} color={colors.onMuted.secondary} />
                <AppText muted style={styles.infoText}>
                  {t('medical.verification.notSureSkip')}
                </AppText>
              </View>
            </GlassCard>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <AppTextInput
              label={t('onboarding.city')}
              placeholder={t('onboarding.cityPlaceholder')}
              wrapperStyle={styles.inputWrapper}
              value={formData.city}
              onChangeText={(v) => updateField('city', v)}
            />
            <AppTextInput
              label={t('onboarding.district')}
              placeholder={t('onboarding.districtPlaceholder')}
              value={formData.district}
              onChangeText={(v) => updateField('district', v)}
            />
            <View style={styles.notificationItem}>
              <View style={styles.notificationText}>
                <AppText variant="heading">{t('onboarding.sharePreciseLocation')}</AppText>
                <AppText muted style={styles.notificationDesc}>
                  {t('onboarding.sharePreciseLocationHint')}
                </AppText>
              </View>
              <AppButton
                variant={formData.consentLocation ? 'primary' : 'secondary'}
                size="small"
                onPress={handleShareLocation}
                disabled={isLocating}
              >
                {isLocating ? '…' : t(formData.consentLocation ? 'onboarding.on' : 'onboarding.off')}
              </AppButton>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <NotificationToggle
              label={t('onboarding.notifyEmergencies')}
              description={t('onboarding.notifyEmergenciesHint')}
              value={formData.emergencyRequests}
              onValueChange={(v) => updateField('emergencyRequests', v)}
            />
            <NotificationToggle
              label={t('onboarding.notifyAppointments')}
              description={t('onboarding.notifyAppointmentsHint')}
              value={formData.appointments}
              onValueChange={(v) => updateField('appointments', v)}
            />
            <NotificationToggle
              label={t('onboarding.notifyDonations')}
              description={t('onboarding.notifyDonationsHint')}
              value={formData.donationReminders}
              onValueChange={(v) => updateField('donationReminders', v)}
            />
            <NotificationToggle
              label={t('onboarding.notifySystem')}
              description={t('onboarding.notifySystemHint')}
              value={formData.system}
              onValueChange={(v) => updateField('system', v)}
            />
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.reviewCard}>
              <ReviewItem
                label={t('onboarding.reviewName')}
                value={`${formData.firstName} ${formData.lastName}`}
              />
              <ReviewItem
                label={t('onboarding.reviewPhone')}
                value={formData.phone || t('onboarding.notProvided')}
              />
              <ReviewItem
                label={t('medical.bloodGroup')}
                value={
                  formData.bloodType && formData.rhFactor
                    ? `${formData.bloodType}${formData.rhFactor === 'POSITIVE' ? '+' : '-'}`
                    : t('onboarding.notProvided')
                }
              />
              <ReviewItem
                label={t('onboarding.reviewLocation')}
                value={formData.city || t('onboarding.notProvided')}
              />
              <ReviewItem
                label={t('onboarding.reviewPreciseLocation')}
                value={t(formData.consentLocation ? 'onboarding.on' : 'onboarding.off')}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return formData.firstName.trim() && formData.lastName.trim();
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isLoading =
    updateUserProfile.isPending || updateDonorProfile.isPending || updateNotificationPreferences.isPending;

  const step = STEPS[currentStep]!;
  const StepIcon = step.icon;

  return (
    <Screen>
      <View style={styles.headerRow}>
        {/* Back is one control in the header, not a second button in the
            footer competing with Continue. On step one it keeps its slot so
            the rail beside it does not jump left when you advance. */}
        {currentStep > 0 ? (
          <IconButton
            icon={ChevronLeft}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.previousStep')}
          />
        ) : (
          <View style={styles.backSpacer} />
        )}
        <AppText muted style={styles.stepLabel}>
          {t('onboarding.stepOf', { current: currentStep + 1, total: STEPS.length })}
        </AppText>
      </View>
      <View style={styles.rail}>
        <StepRail steps={STEPS.length} current={currentStep} />
      </View>

      <View style={styles.stepBadge}>
        <StepIcon size={26} color={colors.primary} />
      </View>
      <AppText style={styles.title}>{t(step.titleKey)}</AppText>
      <AppText muted style={styles.subtitle}>
        {t(step.subtitleKey)}
      </AppText>

      <View style={styles.content}>{renderStep()}</View>

      {finishError && (
        <AppText style={{ color: colors.danger, marginBottom: spacing.md }}>{finishError}</AppText>
      )}

      <View style={styles.footer}>
        <AppButton
          gradient
          trailingIcon={ArrowRight}
          onPress={isLastStep ? handleFinish : handleNext}
          disabled={!canProceed() || isLoading}
          loading={isLoading}
        >
          {t(isLastStep ? 'onboarding.completeSetup' : 'onboarding.continue')}
        </AppButton>
      </View>
    </Screen>
  );
}

function FeatureItem({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureDot} />
      <AppText muted>{text}</AppText>
    </View>
  );
}

function BloodTypeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t('onboarding.a11yBloodType', { type: label })}
      style={({ pressed }) => ({
        flex: 1,
        height: 62,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        // Selection is a tinted fill plus a rose border, not a solid rose
        // block: eight solid blocks would read as eight primary actions, and
        // the chosen one has to stand out from seven neighbours, not from the
        // background.
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryMuted : colors.surfaceElevated,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <AppText
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: selected ? colors.onMuted.primary : colors.text,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function NotificationToggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.notificationItem}>
      <View style={styles.notificationText}>
        <AppText variant="heading">{label}</AppText>
        <AppText muted style={styles.notificationDesc}>
          {description}
        </AppText>
      </View>
      <AppButton
        variant={value ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onValueChange(!value)}
      >
        {value ? 'ON' : 'OFF'}
      </AppButton>
    </View>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <AppText muted>{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Matches IconButton's 40x40, so the rail below keeps the same left edge on
  // every step whether or not there is a back button above it.
  backSpacer: {
    width: 40,
    height: 40,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  rail: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  stepBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  featureList: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  inputWrapper: {
    marginBottom: layout.cardGap,
  },
  bloodTypeRow: {
    flexDirection: 'row',
    gap: layout.cardGap,
    marginBottom: layout.cardGap,
  },
  infoCard: {
    marginTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  notificationText: {
    flex: 1,
    marginRight: spacing.md,
  },
  notificationDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  footer: {
    marginTop: spacing.xl,
  },
  });
}