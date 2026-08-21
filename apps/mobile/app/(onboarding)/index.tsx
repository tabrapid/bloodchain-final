import { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppButton, AppText, Screen, ProgressBar } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useUpdateDonorProfile } from '../../src/hooks/useDonors';
import { useUpdateUserProfile } from '../../src/hooks/useUsers';
import { useAuthStore } from '../../src/stores/auth.store';

const STEPS = ['Welcome', 'Personal', 'Blood Type', 'Location', 'Notifications', 'Review'];

export default function OnboardingWelcome() {
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();
  const updateDonorProfile = useUpdateDonorProfile();
  const updateUserProfile = useUpdateUserProfile();
  const setNeedsOnboarding = useAuthStore((s) => s.setNeedsOnboarding);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bloodType: '',
    rhFactor: '',
    city: '',
    district: '',
    emergencyRequests: true,
    appointments: true,
    donationReminders: true,
    system: true,
    promotional: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      });

      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['donor-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-completion'] });

      setNeedsOnboarding(false);
      router.replace('/(app)/home');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <AppText variant="title" style={styles.title}>
              Welcome to DONOR
            </AppText>
            <AppText muted style={styles.subtitle}>
              Your journey to becoming a life-saver starts here. Let's set up your donor profile.
            </AppText>
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
            <AppText variant="title" style={styles.title}>
              Personal Information
            </AppText>
            <AppText muted style={styles.subtitle}>
              Tell us a bit about yourself.
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor={colors.textMuted}
              value={formData.firstName}
              onChangeText={(v) => updateField('firstName', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor={colors.textMuted}
              value={formData.lastName}
              onChangeText={(v) => updateField('lastName', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v)}
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <AppText variant="title" style={styles.title}>
              Blood Type
            </AppText>
            <AppText muted style={styles.subtitle}>
              Select your blood type. If unknown, you can skip this step.
            </AppText>
            <View style={styles.bloodTypeGrid}>
              {['A', 'B', 'AB', 'O'].map((type) => (
                <BloodTypeButton
                  key={type}
                  type={type}
                  selected={formData.bloodType === type}
                  onPress={() => updateField('bloodType', type)}
                />
              ))}
            </View>
            {formData.bloodType && (
              <View style={styles.rhGroup}>
                <AppText variant="heading" style={styles.rhLabel}>Rh Factor</AppText>
                <View style={styles.rhButtons}>
                  <RhButton
                    label="Positive +"
                    selected={formData.rhFactor === 'POSITIVE'}
                    onPress={() => updateField('rhFactor', 'POSITIVE')}
                  />
                  <RhButton
                    label="Negative -"
                    selected={formData.rhFactor === 'NEGATIVE'}
                    onPress={() => updateField('rhFactor', 'NEGATIVE')}
                  />
                </View>
              </View>
            )}
            <AppText muted style={styles.disclaimer}>
              Your blood type will be marked as unverified until confirmed by an authorized healthcare provider.
            </AppText>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <AppText variant="title" style={styles.title}>
              Location
            </AppText>
            <AppText muted style={styles.subtitle}>
              Where are you located? This helps us find nearby donation centers.
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor={colors.textMuted}
              value={formData.city}
              onChangeText={(v) => updateField('city', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="District (optional)"
              placeholderTextColor={colors.textMuted}
              value={formData.district}
              onChangeText={(v) => updateField('district', v)}
            />
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <AppText variant="title" style={styles.title}>
              Notifications
            </AppText>
            <AppText muted style={styles.subtitle}>
              How would you like to be notified?
            </AppText>
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
            <AppText variant="title" style={styles.title}>
              Review
            </AppText>
            <AppText muted style={styles.subtitle}>
              Review your information before finishing.
            </AppText>
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
  const isLoading = updateUserProfile.isPending || updateDonorProfile.isPending;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText muted style={styles.stepLabel}>
          STEP {currentStep + 1} OF {STEPS.length}
        </AppText>
        <ProgressBar progress={progress} />
      </View>

      <View style={styles.content}>{renderStep()}</View>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <AppButton variant="secondary" onPress={handleBack} style={styles.backButton}>
            Back
          </AppButton>
        )}
        <AppButton
          onPress={isLastStep ? handleFinish : handleNext}
          disabled={!canProceed() || isLoading}
          style={styles.nextButton}
        >
          {isLoading
            ? 'Saving...'
            : isLastStep
            ? 'Complete Setup'
            : 'Continue'}
        </AppButton>
      </View>
    </Screen>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureDot} />
      <AppText muted>{text}</AppText>
    </View>
  );
}

function BloodTypeButton({
  type,
  selected,
  onPress,
}: {
  type: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AppButton
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      style={styles.bloodTypeButton}
    >
      {type}
    </AppButton>
  );
}

function RhButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AppButton
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      style={styles.rhButton}
    >
      {label}
    </AppButton>
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
    <View style={styles.reviewItem}>
      <AppText muted>{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  stepLabel: {
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  bloodTypeButton: {
    flex: 1,
    height: 80,
    fontSize: 24,
  },
  rhGroup: {
    marginBottom: spacing.lg,
  },
  rhLabel: {
    marginBottom: spacing.md,
  },
  rhButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rhButton: {
    flex: 1,
  },
  disclaimer: {
    fontSize: 13,
    marginTop: spacing.lg,
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});