import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  AppButton,
  AppText,
  AppTextInput,
  Avatar,
  Screen,
  ScreenHeader,
} from '../../../src/components';
import { useUserProfile, useUpdateUserProfile } from '../../../src/hooks/useUsers';
import { layout, spacing, useTheme, ThemeColors } from '../../../src/theme';
import { ApiRequestError } from '../../../src/api/client';
import { useTranslation } from '../../../src/i18n';

export default function EditProfile() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: user } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    displayName: user?.displayName ?? '',
    phone: user?.phone ?? '',
  });

  // useState's initializer only runs on first render -- if this screen is
  // reached before `user` is cached (e.g. a deep link straight here), the
  // form would otherwise show blank fields forever, even after the fetch
  // resolves.
  useEffect(() => {
    if (!user) return;
    setFormData({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      displayName: user.displayName ?? '',
      phone: user.phone ?? '',
    });
  }, [user]);

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
          : t('profileEdit.saveFailed'),
      );
    }
  };

  const hasChanges =
    formData.firstName !== (user?.firstName ?? '') ||
    formData.lastName !== (user?.lastName ?? '') ||
    formData.displayName !== (user?.displayName ?? '') ||
    formData.phone !== (user?.phone ?? '');

  const avatarName =
    [formData.firstName, formData.lastName].filter(Boolean).join(' ') ||
    formData.displayName ||
    user?.email ||
    '?';

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScreenHeader title={t('profileEdit.personalSection')} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarBlock}>
            <Avatar name={avatarName} size={72} ring={colors.primary} />
            {user?.email && <AppText style={styles.email}>{user.email}</AppText>}
          </View>

          <View style={styles.fields}>
            <AppTextInput
              label={t('auth.register.firstName')}
              placeholder={t('auth.register.firstName')}
              value={formData.firstName}
              onChangeText={(firstName) => setFormData((prev) => ({ ...prev, firstName }))}
            />
            <AppTextInput
              label={t('auth.register.lastName')}
              placeholder={t('auth.register.lastName')}
              value={formData.lastName}
              onChangeText={(lastName) => setFormData((prev) => ({ ...prev, lastName }))}
            />
            <AppTextInput
              label={t('profileEdit.displayNameOptional')}
              placeholder={t('profileEdit.displayNameHint')}
              value={formData.displayName}
              onChangeText={(displayName) => setFormData((prev) => ({ ...prev, displayName }))}
            />
            <AppTextInput
              label={t('profileEdit.phoneOptional')}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(phone) => setFormData((prev) => ({ ...prev, phone }))}
            />
          </View>

          {saveError && <AppText style={styles.error}>{saveError}</AppText>}

          <AppButton
            onPress={handleSave}
            disabled={!hasChanges || updateProfile.isPending}
            loading={updateProfile.isPending}
            style={styles.save}
          >
            {t('actions.saveChanges')}
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
      gap: layout.cardGap,
    },
    avatarBlock: {
      alignItems: 'center',
      gap: 10,
    },
    email: {
      fontSize: 13,
      color: colors.textMuted,
    },
    fields: {
      gap: 14,
    },
    error: {
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    save: {
      marginTop: 2,
    },
  });
}
