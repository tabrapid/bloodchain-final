import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  AppButton,
  AppText,
  AppTextInput,
  GlassCard,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '../../../src/components';
import { useDonorProfile, useUpdateDonorProfile } from '../../../src/hooks/useDonors';
import { spacing, radius, useTheme, ThemeColors } from '../../../src/theme';
import { ApiRequestError } from '../../../src/api/client';

/**
 * The reference offers the eight blood types as one grid of chips, which is
 * how a donor thinks of their type. The API stores it as two fields, so each
 * chip writes both -- the split is a storage detail and does not belong in
 * the interface.
 */
const BLOOD_TYPE_CHIPS = [
  { label: 'A+', bloodType: 'A', rhFactor: 'POSITIVE' },
  { label: 'A-', bloodType: 'A', rhFactor: 'NEGATIVE' },
  { label: 'B+', bloodType: 'B', rhFactor: 'POSITIVE' },
  { label: 'B-', bloodType: 'B', rhFactor: 'NEGATIVE' },
  { label: 'AB+', bloodType: 'AB', rhFactor: 'POSITIVE' },
  { label: 'AB-', bloodType: 'AB', rhFactor: 'NEGATIVE' },
  { label: 'O+', bloodType: 'O', rhFactor: 'POSITIVE' },
  { label: 'O-', bloodType: 'O', rhFactor: 'NEGATIVE' },
] as const;

export default function EditDonorProfile() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: donor } = useDonorProfile();
  const updateProfile = useUpdateDonorProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bloodType: donor?.bloodType ?? '',
    rhFactor: donor?.rhFactor ?? '',
    city: donor?.city ?? '',
    district: donor?.district ?? '',
  });

  // useState's initializer only runs once, so a screen reached before `donor`
  // is cached would otherwise show blank fields forever.
  useEffect(() => {
    if (!donor) return;
    setFormData({
      bloodType: donor.bloodType ?? '',
      rhFactor: donor.rhFactor ?? '',
      city: donor.city ?? '',
      district: donor.district ?? '',
    });
  }, [donor]);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({
        bloodType: formData.bloodType || undefined,
        rhFactor: formData.rhFactor || undefined,
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

  const hasChanges =
    formData.bloodType !== (donor?.bloodType ?? '') ||
    formData.rhFactor !== (donor?.rhFactor ?? '') ||
    formData.city !== (donor?.city ?? '') ||
    formData.district !== (donor?.district ?? '');

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScreenHeader title="Donor Profile" subtitle="Update your donor information" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionHeader>Blood type</SectionHeader>
          <View style={styles.chipGrid}>
            {BLOOD_TYPE_CHIPS.map((chip) => {
              const selected =
                formData.bloodType === chip.bloodType && formData.rhFactor === chip.rhFactor;
              return (
                <View key={chip.label} style={styles.chipCell}>
                  <Pressable
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        bloodType: chip.bloodType,
                        rhFactor: chip.rhFactor,
                      }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Blood type ${chip.label}`}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      { opacity: pressed && !selected ? 0.6 : 1 },
                    ]}
                  >
                    <AppText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {chip.label}
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <AppText style={styles.note}>
            Your blood type stays marked unverified until an authorized healthcare provider
            confirms it.
          </AppText>

          <SectionHeader>Location</SectionHeader>
          <GlassCard>
            <View style={styles.fields}>
              <AppTextInput
                label="City"
                placeholder="Your city"
                value={formData.city}
                onChangeText={(city) => setFormData((prev) => ({ ...prev, city }))}
              />
              <AppTextInput
                label="District (optional)"
                placeholder="Your district"
                value={formData.district}
                onChangeText={(district) => setFormData((prev) => ({ ...prev, district }))}
              />
            </View>
          </GlassCard>

          {saveError && <AppText style={styles.error}>{saveError}</AppText>}

          <AppButton
            onPress={handleSave}
            disabled={!hasChanges || updateProfile.isPending}
            loading={updateProfile.isPending}
            style={styles.save}
          >
            Save changes
          </AppButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    content: {
      paddingBottom: spacing.xl,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    chipCell: {
      width: '25%',
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    chip: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: colors.glass.standard.fill,
      borderWidth: 1,
      borderColor: colors.glass.standard.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: 'transparent',
    },
    chipLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    chipLabelSelected: {
      fontWeight: '800',
      color: colors.white,
    },
    note: {
      fontSize: 12,
      lineHeight: 18,
      fontStyle: 'italic',
      color: colors.textMuted,
      marginTop: 4,
    },
    fields: {
      gap: 14,
    },
    error: {
      fontSize: 13,
      color: colors.onMuted.danger,
      marginTop: spacing.md,
    },
    save: {
      marginTop: spacing.lg,
    },
  });
}
