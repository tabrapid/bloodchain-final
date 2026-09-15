import { useCallback, useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AlertTriangle, Building2, LogOut, Moon, Sun } from 'lucide-react-native';
import { AppButton, AppHeader, AppText, Badge, Card, EmptyState, LoadingState, Screen } from '../../src/components';
import { useLogout } from '../../src/hooks/useAuth';
import { layout, spacing, useTheme } from '../../src/theme';
import {
  getCourierProfile,
  updateCourierProfile,
  updateCourierStatus,
  type CourierProfile,
} from '../../src/api/courier';
import { useTranslation } from '../../src/i18n';

const STATUS_VARIANT: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  OFFLINE: 'default',
  SUSPENDED: 'danger',
};

export default function CourierProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const logout = useLogout();
  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getCourierProfile();
      setProfile(data);
      setDisplayName(data.displayName);
      setPhone(data.phone || '');
    } catch (err) {
      console.error('Failed to load courier profile:', err);
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
      await updateCourierProfile({ displayName: displayName.trim(), phone: phone.trim() || undefined });
      setSavedMessage(t('courier.profileUpdated'));
      await load();
    } catch (err: any) {
      setError(err?.message || t('courier.profileUpdateFailed'));
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
    } catch (err: any) {
      setError(err?.message || t('courier.statusUpdateFailed'));
    } finally {
      setStatusUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title={t('courier.profileTitle')} subtitle={t('courier.profileSubtitle')} />
        <LoadingState />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <AppHeader title={t('courier.profileTitle')} subtitle={t('courier.profileSubtitle')} />
        <EmptyState
          icon={AlertTriangle}
          title={t('courier.profileLoadFailed')}
          description={t('common.offline')}
        />
        <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
          {t('common.retry')}
        </AppButton>
      </Screen>
    );
  }

  const hasActiveDelivery = !!profile.currentShipmentId;
  const canToggle = (profile.status === 'AVAILABLE' || profile.status === 'OFFLINE') && !hasActiveDelivery;

  return (
    <Screen scroll={false}>
      <AppHeader title={t('courier.profileTitle')} subtitle={t('courier.profileSubtitle')} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: layout.cardGap }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <AppText variant="heading">{t('courier.availability')}</AppText>
            <Badge variant={STATUS_VARIANT[profile.status] || 'default'}>
              {t(`status.courier.${profile.status}`)}
            </Badge>
          </View>
          {canToggle ? (
            <AppButton
              variant={profile.status === 'AVAILABLE' ? 'secondary' : 'primary'}
              onPress={toggleAvailability}
              disabled={statusUpdating}
            >
              {profile.status === 'AVAILABLE' ? <Moon size={18} /> : <Sun size={18} />}
              {t(profile.status === 'AVAILABLE' ? 'courier.goOffline' : 'courier.goAvailable')}
            </AppButton>
          ) : (
            <AppText muted style={{ fontSize: 13 }}>
              {t(hasActiveDelivery ? 'courier.lockedByDelivery' : 'courier.lockedByStatus')}
            </AppText>
          )}
        </Card>

        <Card style={{ marginBottom: layout.cardGap }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Building2 size={18} color={colors.textMuted} />
            <AppText muted>{profile.organizationName}</AppText>
          </View>

          <AppText muted style={{ fontSize: 12, marginBottom: spacing.xs }}>
            {t('courier.displayName')}
          </AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.surfaceSolid,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          />

          <AppText muted style={{ fontSize: 12, marginBottom: spacing.xs }}>{t('table.phone')}</AppText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.surfaceSolid,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          />

          {error && <AppText style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</AppText>}
          {savedMessage && <AppText style={{ color: colors.success, marginBottom: spacing.md }}>{savedMessage}</AppText>}

          <AppButton onPress={handleSave} disabled={saving || !displayName.trim()}>
            {t(saving ? 'common.saving' : 'actions.saveChanges')}
          </AppButton>
        </Card>

        <AppButton variant="ghost" onPress={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={18} color={colors.danger} />
          <AppText style={{ color: colors.danger }}>{t('courier.logOut')}</AppText>
        </AppButton>
      </ScrollView>
    </Screen>
  );
}
