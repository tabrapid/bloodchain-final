import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppText, Screen } from '../../../src/components';
import { useUpdateUserProfile } from '../../../src/hooks/useUsers';
import { useUserProfile } from '../../../src/hooks/useUsers';
import { colors, spacing, radius } from '../../../src/theme';
import { ApiRequestError } from '../../../src/api/client';

export default function EditProfile() {
  const { data: user } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    displayName: user?.displayName || '',
    phone: user?.phone || '',
  });

  // useState's initializer only runs on first render -- if this screen is
  // reached before `user` is cached (e.g. a deep link straight here), the
  // form would otherwise show blank fields forever, even after the fetch
  // resolves.
  useEffect(() => {
    if (!user) return;
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      displayName: user.displayName || '',
      phone: user.phone || '',
    });
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        displayName: formData.displayName || undefined,
        phone: formData.phone || undefined,
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
    formData.firstName !== (user?.firstName || '') ||
    formData.lastName !== (user?.lastName || '') ||
    formData.displayName !== (user?.displayName || '') ||
    formData.phone !== (user?.phone || '');

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <AppText variant="title" style={styles.title}>
            Edit Profile
          </AppText>

          <View style={styles.form}>
            <View style={styles.field}>
              <AppText muted style={styles.label}>First Name</AppText>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={colors.textMuted}
                value={formData.firstName}
                onChangeText={(v) => handleChange('firstName', v)}
              />
            </View>

            <View style={styles.field}>
              <AppText muted style={styles.label}>Last Name</AppText>
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={colors.textMuted}
                value={formData.lastName}
                onChangeText={(v) => handleChange('lastName', v)}
              />
            </View>

            <View style={styles.field}>
              <AppText muted style={styles.label}>Display Name (optional)</AppText>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor={colors.textMuted}
                value={formData.displayName}
                onChangeText={(v) => handleChange('displayName', v)}
              />
            </View>

            <View style={styles.field}>
              <AppText muted style={styles.label}>Phone (optional)</AppText>
              <TextInput
                style={styles.input}
                placeholder="+1 234 567 8900"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(v) => handleChange('phone', v)}
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
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
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