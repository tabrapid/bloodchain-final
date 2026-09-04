import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, Smartphone } from 'lucide-react-native';
import { AppButton, AppText, Card, Screen, ScreenHeader, SectionHeader, ListItem, Divider } from '../../src/components';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '../../src/hooks/useSessions';
import { useLogout } from '../../src/hooks/useAuth';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { clearAuthTokens } from '../../src/auth/storage';
import { useAuthStore } from '../../src/stores/auth.store';
import { apiRequest, ApiRequestError } from '../../src/api/client';
import { apiBasePath } from '../../src/api/config';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Active now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Security() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const logout = useLogout();
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const { data: donorProfile } = useDonorProfile();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      Alert.alert('Error', 'Password must be at least 12 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest(`${apiBasePath}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      Alert.alert('Success', 'Password changed successfully. Please log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await clearAuthTokens();
      clearAuth();
      router.replace('/(auth)/login');
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.error.message : 'Something went wrong';
      Alert.alert('Error', message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    Alert.alert('Revoke Session', 'This device will be signed out immediately. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => revokeSession.mutate(sessionId),
      },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Logout All Devices',
      'This will log you out of all devices except the current one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAllSessions.mutateAsync();
              Alert.alert('Success', 'All sessions have been revoked.');
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke sessions');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Security" />
      <ScrollView contentContainerStyle={styles.content}>

        <SectionHeader>PASSWORD</SectionHeader>
        <Card>
          <View style={styles.field}>
            <AppText muted style={styles.label}>Current Password</AppText>
            <View>
              <TextInput
                style={[styles.input, styles.inputWithToggle]}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <Pressable
                onPress={() => setShowCurrentPassword((v) => !v)}
                style={styles.toggleButton}
                hitSlop={8}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <AppText muted style={styles.label}>New Password</AppText>
            <View>
              <TextInput
                style={[styles.input, styles.inputWithToggle]}
                placeholder="Enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Pressable
                onPress={() => setShowNewPassword((v) => !v)}
                style={styles.toggleButton}
                hitSlop={8}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
            <AppText muted style={styles.hint}>
              Must be at least 12 characters
            </AppText>
          </View>

          <View style={styles.field}>
            <AppText muted style={styles.label}>Confirm New Password</AppText>
            <View>
              <TextInput
                style={[styles.input, styles.inputWithToggle]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                style={styles.toggleButton}
                hitSlop={8}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>

          <AppButton
            onPress={handleChangePassword}
            disabled={
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              isChangingPassword
            }
            style={styles.changePasswordButton}
          >
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </AppButton>
        </Card>

        <SectionHeader>ACTIVE SESSIONS</SectionHeader>
        <Card>
          {sessions && sessions.length > 0 ? (
            sessions.map((session, index) => (
              <View key={session.id}>
                {index > 0 && <Divider />}
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <Smartphone size={16} color={colors.textMuted} />
                  </View>
                  <View style={styles.sessionInfo}>
                    <AppText style={{ fontSize: 14, fontWeight: '500' }}>
                      {session.deviceName || session.deviceType || 'Unknown device'}
                    </AppText>
                    <AppText muted style={{ fontSize: 11, marginTop: 1 }}>
                      {session.ipAddress ? `${session.ipAddress} · ` : ''}
                      {formatRelativeTime(session.lastUsedAt || session.createdAt)}
                    </AppText>
                  </View>
                  <Pressable onPress={() => handleRevokeSession(session.id)} hitSlop={8}>
                    <AppText style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>
                      Revoke
                    </AppText>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <AppText muted style={{ fontSize: 13 }}>
              No other active sessions.
            </AppText>
          )}
        </Card>

        <Card style={styles.logoutAllCard}>
          <ListItem
            title="Logout from all devices"
            subtitle="Revoke all active sessions"
            destructive
            onPress={handleLogoutAll}
          />
        </Card>

        <SectionHeader>ACCOUNT STATUS</SectionHeader>
        <Card>
          <View style={styles.statusItem}>
            <AppText muted>Account Status</AppText>
            <AppText
              variant="heading"
              style={{
                color:
                  donorProfile?.donorStatus === 'ACTIVE'
                    ? colors.success
                    : donorProfile?.donorStatus
                    ? colors.warning
                    : colors.textMuted,
              }}
            >
              {donorProfile?.donorStatus
                ? donorProfile.donorStatus.charAt(0) + donorProfile.donorStatus.slice(1).toLowerCase()
                : '—'}
            </AppText>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing['2xl'],
    },
    field: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: 13,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.surfaceSolid,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    inputWithToggle: {
      paddingRight: 48,
    },
    toggleButton: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    hint: {
      fontSize: 12,
      marginTop: spacing.xs,
    },
    changePasswordButton: {
      marginTop: spacing.sm,
    },
    statusItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    sessionIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionInfo: {
      flex: 1,
    },
    logoutAllCard: {
      marginTop: spacing.md,
    },
  });
}