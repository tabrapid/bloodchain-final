import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  OptionGrid,
  ScreenHeader,
  SectionHeader,
  Stack,
  Text,
  Well,
} from '../../../src/design';
import { useDonorProfile, useUpdateDonorProfile } from '../../../src/hooks/useDonors';
import { ApiRequestError } from '../../../src/api/client';
import { useTranslation } from '../../../src/i18n';

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
  const { t } = useTranslation();
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
        error instanceof ApiRequestError ? error.error.message : t('profileEdit.saveFailed'),
      );
    }
  };

  const hasChanges =
    formData.bloodType !== (donor?.bloodType ?? '') ||
    formData.rhFactor !== (donor?.rhFactor ?? '') ||
    formData.city !== (donor?.city ?? '') ||
    formData.district !== (donor?.district ?? '');

  const selectedLabel =
    BLOOD_TYPE_CHIPS.find(
      (chip) => chip.bloodType === formData.bloodType && chip.rhFactor === formData.rhFactor,
    )?.label ?? null;

  return (
    <FormScreen
      header={
        <ScreenHeader
          title={t('profileEdit.donorTitle')}
          eyebrow={t('profileEdit.donorSubtitle')}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        <Stack gap="md">
          <SectionHeader title={t('medical.bloodGroup')} />
          {/* The chips announced themselves as `Blood type A+` in English on
              a screen that ships in three languages, and as `button` rather
              than one of eight radios. */}
          <OptionGrid
            accessibilityLabel={t('medical.bloodGroup')}
            columns={4}
            value={selectedLabel}
            onChange={(label) => {
              const chip = BLOOD_TYPE_CHIPS.find((candidate) => candidate.label === label)!;
              setFormData((prev) => ({
                ...prev,
                bloodType: chip.bloodType,
                rhFactor: chip.rhFactor,
              }));
            }}
            options={BLOOD_TYPE_CHIPS.map((chip) => ({
              value: chip.label,
              label: chip.label,
              accessibilityLabel: t('onboarding.a11yBloodType', { type: chip.label }),
            }))}
          />
          <Well>
            <Text variant="caption" tone="secondary">
              {t('medical.verification.unverifiedNote')}
            </Text>
          </Well>
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('table.location')} />
          <Field
            label={t('table.city')}
            placeholder={t('profileEdit.cityPlaceholder')}
            value={formData.city}
            onChangeText={(city) => setFormData((prev) => ({ ...prev, city }))}
          />
          <Field
            label={t('profileEdit.districtOptional')}
            placeholder={t('profileEdit.districtPlaceholder')}
            value={formData.district}
            onChangeText={(district) => setFormData((prev) => ({ ...prev, district }))}
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
