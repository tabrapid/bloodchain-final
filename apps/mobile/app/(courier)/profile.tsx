import { useCallback, useEffect, useState } from 'react';
import { Building2, LogOut, Moon, Sun } from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ConfirmationSheet,
  Field,
  FormScreen,
  PhoneField,
  Row,
  ScreenHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  iconSize,
  useDesign,
  type StatusTone,
} from '../../src/design';
import { useLogout } from '../../src/hooks/useAuth';
import {
  getCourierProfile,
  updateCourierProfile,
  updateCourierStatus,
  type CourierProfile,
} from '../../src/api/courier';
import { useTranslation } from '../../src/i18n';
import { normalizePhone } from '@bloodchain/validation';

const STATUS_TONE: Record<string, StatusTone> = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  OFFLINE: 'neutral',
  SUSPENDED: 'critical',
};

/** The stored `+998901234567` as the nine digits the field shows. */
function toLocalDigits(phone: string | undefined | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').replace(/^998/, '');
}

export default function CourierProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const logout = useLogout();
  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getCourierProfile();
      setProfile(data);
      setDisplayName(data.displayName);
      setPhone(toLocalDigits(data.phone));
      setError(null);
    } catch {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await updateCourierProfile({
        displayName: displayName.trim(),
        phone: phone ? (normalizePhone(`+998${phone}`) ?? undefined) : undefined,
      });
      setSavedMessage(t('courier.profileUpdated'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('courier.profileUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    const nextStatus = profile.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    setStatusUpdating(true);
    setError(null);
    try {
      await updateCourierStatus(nextStatus);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('courier.statusUpdateFailed'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const header = (
    <ScreenHeader title={t('courier.profileTitle')} size="large" subtitle={t('courier.profileSubtitle')} />
  );

  if (isLoading) {
    return (
      <FormScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={96} />
          <Skeleton height={180} />
        </Stack>
      </FormScreen>
    );
  }

  if (!profile) {
    return (
      <FormScreen header={header}>
        <Stack gap="lg">
          <Banner tone="critical" title={t('courier.profileLoadFailed')} description={t('common.offline')} />
          <Button label={t('common.retry')} variant="secondary" onPress={() => void load()} />
        </Stack>
      </FormScreen>
    );
  }

  const hasActiveDelivery = !!profile.currentShipmentId;
  const canToggle =
    (profile.status === 'AVAILABLE' || profile.status === 'OFFLINE') && !hasActiveDelivery;

  return (
    <FormScreen header={header}>
      <Stack gap="xl">
        <Surface tone={profile.status === 'AVAILABLE' ? 'success' : undefined}>
          <Stack gap="md">
            <Row gap="md">
              <Text variant="title" style={{ flex: 1 }}>
                {t('courier.availability')}
              </Text>
              <Badge
                label={t(`status.courier.${profile.status}`)}
                tone={STATUS_TONE[profile.status] ?? 'neutral'}
                dot
              />
            </Row>
            {canToggle ? (
              <Button
                label={t(profile.status === 'AVAILABLE' ? 'courier.goOffline' : 'courier.goAvailable')}
                variant={profile.status === 'AVAILABLE' ? 'secondary' : 'primary'}
                loading={statusUpdating}
                icon={({ size, color }) =>
                  profile.status === 'AVAILABLE' ? (
                    <Moon size={size} color={color} />
                  ) : (
                    <Sun size={size} color={color} />
                  )
                }
                onPress={() => void toggleAvailability()}
              />
            ) : (
              <Text variant="caption" tone="secondary">
                {t(hasActiveDelivery ? 'courier.lockedByDelivery' : 'courier.lockedByStatus')}
              </Text>
            )}
          </Stack>
        </Surface>

        <Surface level="flat">
          <Stack gap="lg">
            <Row gap="sm">
              <Building2 size={iconSize.sm} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                {profile.organizationName}
              </Text>
            </Row>

            <Field
              label={t('courier.displayName')}
              value={displayName}
              onChangeText={setDisplayName}
              required
            />
            {/* Free-typed with a phone keypad before; the prefix is drawn now
                and the number is normalized like everywhere else in the app. */}
            <PhoneField
              prefix="+998"
              label={t('table.phone')}
              placeholder={t('auth.phone.placeholder')}
              value={phone}
              onChangeText={(value) => setPhone(value.replace(/\D/g, ''))}
            />

            {error ? <Banner tone="critical" title={error} /> : null}
            {savedMessage ? <Banner tone="success" title={savedMessage} /> : null}

            <Button
              label={saving ? t('common.saving') : t('actions.saveChanges')}
              loading={saving}
              disabled={!displayName.trim()}
              onPress={() => void handleSave()}
            />
          </Stack>
        </Surface>

        <Button
          label={t('courier.logOut')}
          variant="secondary"
          accent="critical"
          icon={({ size, color }) => <LogOut size={size} color={color} />}
          onPress={() => setConfirmingLogout(true)}
        />
      </Stack>

      {/* A courier signing out mid-shift stops receiving assignments, so the
          one question is worth asking. */}
      <ConfirmationSheet
        visible={confirmingLogout}
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false);
          logout.mutate();
        }}
        title={t('courier.logOut')}
        description={t('profile.signOutBody')}
        confirmLabel={t('courier.logOut')}
        cancelLabel={t('common.cancel')}
        busy={logout.isPending}
        destructive
      />
    </FormScreen>
  );
}
