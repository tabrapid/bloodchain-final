import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Avatar,
  Banner,
  Button,
  Field,
  FormScreen,
  PhoneField,
  ScreenHeader,
  Stack,
  Text,
} from '../../../src/design';
import { useUserProfile, useUpdateUserProfile } from '../../../src/hooks/useUsers';
import { ApiRequestError } from '../../../src/api/client';
import { useTranslation } from '../../../src/i18n';
import { normalizePhone } from '@bloodchain/validation';

/** The stored `+998901234567` as the nine digits the field shows. */
function toLocalDigits(phone: string | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').replace(/^998/, '');
}

export default function EditProfile() {
  const { t } = useTranslation();
  const { data: user } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    displayName: user?.displayName ?? '',
    phone: toLocalDigits(user?.phone),
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
      phone: toLocalDigits(user.phone),
    });
  }, [user]);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        displayName: formData.displayName || undefined,
        phone: formData.phone ? (normalizePhone(`+998${formData.phone}`) ?? undefined) : undefined,
      });
      router.back();
    } catch (error) {
      setSaveError(
        error instanceof ApiRequestError ? error.error.message : t('profileEdit.saveFailed'),
      );
    }
  };

  const hasChanges =
    formData.firstName !== (user?.firstName ?? '') ||
    formData.lastName !== (user?.lastName ?? '') ||
    formData.displayName !== (user?.displayName ?? '') ||
    formData.phone !== toLocalDigits(user?.phone);

  const avatarName =
    [formData.firstName, formData.lastName].filter(Boolean).join(' ') ||
    formData.displayName ||
    user?.email ||
    '?';

  return (
    <FormScreen
      header={
        <ScreenHeader
          title={t('profileEdit.personalSection')}
          size="large"
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Avatar name={avatarName} size={72} />
          {user?.email ? (
            <Text variant="caption" tone="tertiary">
              {user.email}
            </Text>
          ) : null}
        </View>

        <Stack gap="lg">
          <Field
            label={t('auth.register.firstName')}
            placeholder={t('auth.register.firstNamePlaceholder')}
            value={formData.firstName}
            onChangeText={(firstName) => setFormData((prev) => ({ ...prev, firstName }))}
            autoComplete="given-name"
          />
          <Field
            label={t('auth.register.lastName')}
            placeholder={t('auth.register.lastNamePlaceholder')}
            value={formData.lastName}
            onChangeText={(lastName) => setFormData((prev) => ({ ...prev, lastName }))}
            autoComplete="family-name"
          />
          <Field
            label={t('profileEdit.displayNameOptional')}
            placeholder={t('profileEdit.displayNameHint')}
            value={formData.displayName}
            onChangeText={(displayName) => setFormData((prev) => ({ ...prev, displayName }))}
          />
          {/* The placeholder here was `+1 234 567 8900` -- a United States
              number, on a product that only accepts Uzbekistan ones and
              rejects anything else at the API. */}
          <PhoneField
            prefix="+998"
            label={t('profileEdit.phoneOptional')}
            placeholder={t('auth.phone.placeholder')}
            value={formData.phone}
            onChangeText={(phone) =>
              setFormData((prev) => ({ ...prev, phone: phone.replace(/\D/g, '') }))
            }
          />
        </Stack>

        {saveError ? <Banner tone="critical" title={saveError} /> : null}

        <Button
          label={t('actions.saveChanges')}
          disabled={!hasChanges || updateProfile.isPending}
          loading={updateProfile.isPending}
          onPress={() => void handleSave()}
        />
      </Stack>
    </FormScreen>
  );
}
