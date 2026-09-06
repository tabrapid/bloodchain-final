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

/**
 * Each step's icon, headline and one-line explanation live here rather than
 * inside the six branches of `renderStep`, so the header renders them once and
 * every step is guaranteed the same anatomy: badge, headline, explanation,
 * controls. The branches are left with only the controls that differ.
 */
const STEPS: { icon: LucideIcon; title: string; subtitle: string }[] = [
  {
    icon: HeartHandshake,
    title: 'Welcome to Bloodchain',
    subtitle: 'Your journey to becoming a life-saver starts here. Let us set up your donor profile.',
  },
  {
    icon: UserRound,
    title: 'What should we call you?',
    subtitle: 'This is the name blood centres will see on your appointments.',
  },
  {
    icon: Droplet,
    title: "What's your blood type?",
    subtitle: 'This helps us match you with the requests you can actually answer.',
  },
  {
    icon: MapPin,
    title: 'Where are you based?',
    subtitle: 'So we can point you at the donation centres nearest to you.',
  },
  {
    icon: Bell,
    title: 'What should we tell you about?',
    subtitle: 'You can change any of these later in your profile.',
  },
  {
    icon: CheckCircle2,
    title: 'Does this look right?',
    subtitle: 'One last check before we save your profile.',
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
          'Location Permission Needed',
          'Bloodchain uses your location to match you with nearby emergency requests faster. You can still donate without it.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateField('consentLocation', true);
      updateField('latitude', position.coords.latitude);
      updateField('longitude', position.coords.longitude);
    } catch {
      Alert.alert('Could Not Get Location', 'Please try again, or skip this - you can still donate without it.');
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
          : 'Something went wrong saving your profile. Please try again.',
      );
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.featureList}>
              <FeatureItem text="Track your donation history" />
              <FeatureItem text="Get notified about emergencies" />
              <FeatureItem text="Book donation appointments" />
              <FeatureItem text="Access your health records" />
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <AppTextInput
              label="First name"
              placeholder="Alex"
              wrapperStyle={styles.inputWrapper}
              value={formData.firstName}
              onChangeText={(v) => updateField('firstName', v)}
            />
            <AppTextInput
              label="Last name"
              placeholder="Johnson"
              wrapperStyle={styles.inputWrapper}
              value={formData.lastName}
              onChangeText={(v) => updateField('lastName', v)}
            />
            <AppTextInput
              label="Phone (optional)"
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
                  Not sure? Skip this — you can always set it later, and a blood centre confirms it
                  at your first donation either way.
                </AppText>
              </View>
            </GlassCard>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <AppTextInput
              label="City"
              placeholder="Tashkent"
              wrapperStyle={styles.inputWrapper}
              value={formData.city}
              onChangeText={(v) => updateField('city', v)}
            />
            <AppTextInput
              label="District (optional)"
              placeholder="Yunusabad"
              value={formData.district}
              onChangeText={(v) => updateField('district', v)}
            />
            <View style={styles.notificationItem}>
              <View style={styles.notificationText}>
                <AppText variant="heading">Share precise location</AppText>
                <AppText muted style={styles.notificationDesc}>
                  Lets us match you with the nearest emergency requests first. Optional.
                </AppText>
              </View>
              <AppButton
                variant={formData.consentLocation ? 'primary' : 'secondary'}
                size="small"
                onPress={handleShareLocation}
                disabled={isLocating}
              >
                {isLocating ? '...' : formData.consentLocation ? 'ON' : 'OFF'}
              </AppButton>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <NotificationToggle
              label="Emergency blood requests"
              description="Be alerted when there is an urgent need"
              value={formData.emergencyRequests}
              onValueChange={(v) => updateField('emergencyRequests', v)}
            />
            <NotificationToggle
              label="Appointment reminders"
              description="Get reminded about upcoming donations"
              value={formData.appointments}
              onValueChange={(v) => updateField('appointments', v)}
            />
            <NotificationToggle
              label="Donation reminders"
              description="Stay informed about your donation schedule"
              value={formData.donationReminders}
              onValueChange={(v) => updateField('donationReminders', v)}
            />
            <NotificationToggle
              label="System notifications"
              description="Important updates about your account"
              value={formData.system}
              onValueChange={(v) => updateField('system', v)}
            />
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.reviewCard}>
              <ReviewItem label="Name" value={`${formData.firstName} ${formData.lastName}`} />
              <ReviewItem label="Phone" value={formData.phone || 'Not provided'} />
              <ReviewItem
                label="Blood Type"
                value={
                  formData.bloodType && formData.rhFactor
                    ? `${formData.bloodType}${formData.rhFactor === 'POSITIVE' ? '+' : '-'}`
                    : 'Not provided'
                }
              />
              <ReviewItem label="Location" value={formData.city || 'Not provided'} />
              <ReviewItem
                label="Precise Location Sharing"
                value={formData.consentLocation ? 'On' : 'Off'}
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
            accessibilityLabel="Previous step"
          />
        ) : (
          <View style={styles.backSpacer} />
        )}
        <AppText muted style={styles.stepLabel}>
          {currentStep + 1} of {STEPS.length}
        </AppText>
      </View>
      <View style={styles.rail}>
        <StepRail steps={STEPS.length} current={currentStep} />
      </View>

      <View style={styles.stepBadge}>
        <StepIcon size={26} color={colors.primary} />
      </View>
      <AppText style={styles.title}>{step.title}</AppText>
      <AppText muted style={styles.subtitle}>
        {step.subtitle}
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
          {isLastStep ? 'Complete Setup' : 'Continue'}
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Blood type ${label}`}
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