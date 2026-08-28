import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppText, Card, Screen } from '../../../src/components';
import { useUpdateDonorProfile } from '../../../src/hooks/useDonors';
import { useDonorProfile } from '../../../src/hooks/useDonors';
import { colors, spacing, radius } from '../../../src/theme';
import { ApiRequestError } from '../../../src/api/client';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const RH_FACTORS = [
  { value: 'POSITIVE', label: 'Rh Positive +' },
  { value: 'NEGATIVE', label: 'Rh Negative -' },
] as const;

export default function EditDonorProfile() {
  const { data: donor } = useDonorProfile();
  const updateProfile = useUpdateDonorProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bloodType: donor?.bloodType || '',
    rhFactor: donor?.rhFactor || '',
    city: donor?.city || '',
    district: donor?.district || '',
  });

  // See profile/edit.tsx's identical fix: useState's initializer only runs
  // once, so a screen reached before `donor` is cached would otherwise
  // show blank fields forever.
  useEffect(() => {
    if (!donor) return;
    setFormData({
      bloodType: donor.bloodType || '',
      rhFactor: donor.rhFactor || '',
      city: donor.city || '',
      district: donor.district || '',
    });
  }, [donor]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({
        bloodType: formData.bloodType as any || undefined,
        rhFactor: formData.rhFactor as any || undefined,
        city: formData.city || undefined,
        district: formData.district || undefined,
      });
      router.back();
    } catch (error) {
      setSaveError(
        error instanceof ApiRequestError
          ? error.error.message
          : 'Something went wrong saving your changes. Please try again.',
      );
    }
  };

  const isLoading = updateProfile.isPending;
  const hasChanges =
    formData.bloodType !== (donor?.bloodType || '') ||
    formData.rhFactor !== (donor?.rhFactor || '') ||
    formData.city !== (donor?.city || '') ||
    formData.district !== (donor?.district || '');

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <AppText variant="title" style={styles.title}>
            Donor Profile
          </AppText>

          <View style={styles.section}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Blood Type
            </AppText>
            <AppText muted style={styles.sectionDesc}>
              Select your blood type. If unknown, leave as is.
            </AppText>

            <View style={styles.bloodTypeGrid}>
              {BLOOD_TYPES.map((type) => (
                <AppButton
                  key={type}
                  variant={formData.bloodType === type ? 'primary' : 'secondary'}
                  onPress={() => handleChange('bloodType', type)}
                  style={styles.bloodTypeButton}
                >
                  {type}
                </AppButton>
              ))}
            </View>

            {formData.bloodType && (
              <View style={styles.rhSection}>
                <AppText muted style={styles.rhLabel}>Rh Factor</AppText>
                <View style={styles.rhButtons}>
                  {RH_FACTORS.map((rh) => (
                    <AppButton
                      key={rh.value}
                      variant={formData.rhFactor === rh.value ? 'primary' : 'secondary'}
                      onPress={() => handleChange('rhFactor', rh.value)}
                      style={styles.rhButton}
                    >
                      {rh.label}
                    </AppButton>
                  ))}
                </View>
              </View>
            )}

            <AppText muted style={styles.disclaimer}>
              Your blood type will be marked as unverified until confirmed by an authorized healthcare provider.
            </AppText>
          </View>

          <View style={styles.section}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Location
            </AppText>

            <View style={styles.field}>
              <AppText muted style={styles.label}>City</AppText>
              <TextInput
                style={styles.input}
                placeholder="Your city"
                placeholderTextColor={colors.textMuted}
                value={formData.city}
                onChangeText={(v) => handleChange('city', v)}
              />
            </View>

            <View style={styles.field}>
              <AppText muted style={styles.label}>District (optional)</AppText>
              <TextInput
                style={styles.input}
                placeholder="Your district"
                placeholderTextColor={colors.textMuted}
                value={formData.district}
                onChangeText={(v) => handleChange('district', v)}
              />
            </View>
          </View>

          {saveError && (
            <AppText style={{ color: colors.danger, marginTop: spacing.lg }}>{saveError}</AppText>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            variant="secondary"
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            Cancel
          </AppButton>
          <AppButton
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
            style={styles.saveButton}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </AppButton>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    marginBottom: spacing.md,
    fontSize: 14,
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bloodTypeButton: {
    flex: 1,
    height: 56,
  },
  rhSection: {
    marginBottom: spacing.lg,
  },
  rhLabel: {
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  rhButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rhButton: {
    flex: 1,
  },
  disclaimer: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});