import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, Key, Smartphone, LogOut } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  AppTextInput,
  Badge,
  GlassCard,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '../../src/components';
import { spacing, useTheme, ThemeColors } from '../../src/theme';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '../../src/hooks/useSessions';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { clearAuthTokens } from '../../src/auth/storage';
import { useAuthStore } from '../../src/stores/auth.store';
import { apiRequest, ApiRequestError } from '../../src/api/client';
import { apiBasePath } from '../../src/api/config';

const MIN_PASSWORD_LENGTH = 12;

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return 'Active now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function Security() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const { data: donorProfile } = useDonorProfile();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reveal, setReveal] = useState({ current: false, next: false, confirm: false });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Validated inline rather than behind an alert on submit: a rule the donor
  // can read while typing is the difference between one attempt and three.
  const lengthError =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH
      ? `Must be at least ${MIN_PASSWORD_LENGTH} characters`
      : undefined;
  const matchError =
    confirmPassword.length > 0 && confirmPassword !== newPassword
      ? 'Passwords do not match'
      : undefined;
  const canSubmit =
    !!currentPassword &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === newPassword &&
    !isChangingPassword;

  const handleChangePassword = async () => {
    setIsChangingPassword(true);
    try {
      await apiRequest(`${apiBasePath}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      Alert.alert('Password changed', 'Please log in again with your new password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await clearAuthTokens();
      clearAuth();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert(
        'Could not change password',
        error instanceof ApiRequestError ? error.error.message : 'Something went wrong.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    Alert.alert('Revoke session', 'This device will be signed out immediately. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => revokeSession.mutate(sessionId) },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Log out everywhere',
      'This signs you out of every device except this one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAllSessions.mutateAsync();
              Alert.alert('Done', 'All other sessions have been revoked.');
            } catch {
              Alert.alert('Error', 'Failed to revoke sessions.');
            }
          },
        },
      ],
    );
  };

  const status = donorProfile?.donorStatus;

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Security" subtitle="Account security settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader>Authentication</SectionHeader>
        <GlassCard>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <Key size={16} color={colors.onMuted.success} />
            </View>
            <View style={styles.cardHeadBody}>
              <AppText style={styles.cardHeadTitle}>Change password</AppText>
              <AppText style={styles.cardHeadMeta}>
                At least {MIN_PASSWORD_LENGTH} characters
              </AppText>
            </View>
          </View>

          <View style={styles.fields}>
            <AppTextInput
              label="Current password"
              placeholder="Enter current password"
              secureTextEntry={!reveal.current}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
              trailing={
                <RevealToggle
                  shown={reveal.current}
                  onToggle={() => setReveal((r) => ({ ...r, current: !r.current }))}
                />
              }
            />
            <AppTextInput
              label="New password"
              placeholder="Enter new password"
              secureTextEntry={!reveal.next}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              error={lengthError}
              trailing={
                <RevealToggle
                  shown={reveal.next}
                  onToggle={() => setReveal((r) => ({ ...r, next: !r.next }))}
                />
              }
            />
            <AppTextInput
              label="Confirm new password"
              placeholder="Confirm new password"
              secureTextEntry={!reveal.confirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              error={matchError}
              trailing={
                <RevealToggle
                  shown={reveal.confirm}
                  onToggle={() => setReveal((r) => ({ ...r, confirm: !r.confirm }))}
                />
              }
            />
          </View>

          <AppButton
            onPress={handleChangePassword}
            disabled={!canSubmit}
            loading={isChangingPassword}
            style={styles.submit}
          >
            Change password
          </AppButton>
        </GlassCard>

        <SectionHeader>Active sessions</SectionHeader>
        <GlassCard>
          {sessions && sessions.length > 0 ? (
            <View style={styles.sessionList}>
              {sessions.map((session, index) => (
                <View key={session.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionIcon}>
                      <Smartphone size={16} color={colors.textMuted} />
                    </View>
                    <View style={styles.sessionBody}>
                      <AppText style={styles.sessionDevice}>
                        {session.deviceName || session.deviceType || 'Unknown device'}
                      </AppText>
                      <AppText style={styles.sessionMeta}>
                        {session.ipAddress ? `${session.ipAddress} · ` : ''}
                        {formatRelativeTime(session.lastUsedAt ?? session.createdAt)}
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => handleRevokeSession(session.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Revoke ${session.deviceName ?? 'this session'}`}
                    >
                      <AppText style={styles.revoke}>Revoke</AppText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <AppText style={styles.emptyText}>No other active sessions.</AppText>
          )}
        </GlassCard>

        <Pressable
          onPress={handleLogoutAll}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <GlassCard style={styles.compactCard}>
            <View style={styles.compactRow}>
              <View style={styles.dangerIcon}>
                <LogOut size={16} color={colors.onMuted.danger} />
              </View>
              <View style={styles.compactBody}>
                <AppText style={styles.dangerTitle}>Log out from all devices</AppText>
                <AppText style={styles.sessionMeta}>Revokes every other active session</AppText>
              </View>
            </View>
          </GlassCard>
        </Pressable>

        <SectionHeader>Account status</SectionHeader>
        <GlassCard style={styles.compactCard}>
          <View style={styles.statusRow}>
            <AppText style={styles.statusLabel}>Donor status</AppText>
            <Badge
              variant={status === 'ACTIVE' ? 'success' : status ? 'warning' : 'default'}
            >
              {status ? status.replace(/_/g, ' ').toLowerCase() : 'unknown'}
            </Badge>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? (
        <EyeOff size={20} color={colors.textMuted} />
      ) : (
        <Eye size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing['2xl'],
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: spacing.md,
    },
    cardHeadIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.successMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeadBody: { flex: 1 },
    cardHeadTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    cardHeadMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    fields: {
      gap: 14,
    },
    submit: {
      marginTop: spacing.md,
    },

    sessionList: {
      gap: 14,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginBottom: 14,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sessionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionBody: { flex: 1 },
    sessionDevice: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    sessionMeta: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    revoke: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
    },

    compactCard: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    compactBody: { flex: 1 },
    dangerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.dangerMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.onMuted.danger,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      minHeight: 36,
    },
    statusLabel: {
      fontSize: 14,
      color: colors.text,
    },
  });
}
