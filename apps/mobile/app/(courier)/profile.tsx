import { useCallback, useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AlertTriangle, Building2, LogOut, Moon, Sun } from 'lucide-react-native';
import { AppButton, AppText, Badge, Card, EmptyState, LoadingState, Screen } from '../../src/components';
import { useLogout } from '../../src/hooks/useAuth';
import { spacing, useTheme } from '../../src/theme';
import {
  getCourierProfile,
  updateCourierProfile,
  updateCourierStatus,
  type CourierProfile,
} from '../../src/api/courier';

const STATUS_VARIANT: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  OFFLINE: 'default',
  SUSPENDED: 'danger',
};

export default function CourierProfileScreen() {
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
      setSavedMessage('Profile updated');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
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
      setError(err?.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <AppText variant="title" style={{ marginBottom: spacing.lg }}>Profile</AppText>
        <LoadingState />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <AppText variant="title" style={{ marginBottom: spacing.lg }}>Profile</AppText>
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your profile"
          description="Something went wrong reaching the server. Check your connection and try again."
        />
        <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
          Retry
        </AppButton>
      </Screen>
    );
  }

  const hasActiveDelivery = !!profile.currentShipmentId;
  const canToggle = (profile.status === 'AVAILABLE' || profile.status === 'OFFLINE') && !hasActiveDelivery;

  return (
    <Screen scroll={false}>
      <AppText variant="title" style={{ marginBottom: spacing.md }}>Profile</AppText>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <AppText variant="heading">Availability</AppText>
            <Badge variant={STATUS_VARIANT[profile.status] || 'default'}>{profile.status}</Badge>
          </View>
          {canToggle ? (
            <AppButton
              variant={profile.status === 'AVAILABLE' ? 'secondary' : 'primary'}
              onPress={toggleAvailability}
              disabled={statusUpdating}
            >
              {profile.status === 'AVAILABLE' ? <Moon size={18} /> : <Sun size={18} />}
              {profile.status === 'AVAILABLE' ? 'Go Offline' : 'Go Available'}
            </AppButton>
          ) : (
            <AppText muted style={{ fontSize: 13 }}>
              {hasActiveDelivery
                ? "You have an active delivery — availability can't change until it's finished."
                : 'Availability updates once your current status clears.'}
            </AppText>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Building2 size={18} color={colors.textMuted} />
            <AppText muted>{profile.organizationName}</AppText>
          </View>

          <AppText muted style={{ fontSize: 12, marginBottom: spacing.xs }}>Display Name</AppText>
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

          <AppText muted style={{ fontSize: 12, marginBottom: spacing.xs }}>Phone</AppText>
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
            {saving ? 'Saving...' : 'Save Changes'}
          </AppButton>
        </Card>

        <AppButton variant="ghost" onPress={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={18} color={colors.danger} />
          <AppText style={{ color: colors.danger }}>Log Out</AppText>
        </AppButton>
      </ScrollView>
    </Screen>
  );
}
