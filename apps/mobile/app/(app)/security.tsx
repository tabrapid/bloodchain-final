import { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppText, Card, Screen, SectionHeader, ListItem, Divider } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useRevokeAllSessions } from '../../src/hooks/useSessions';
import { useLogout } from '../../src/hooks/useAuth';
import { clearAuthTokens } from '../../src/auth/storage';
import { useAuthStore } from '../../src/stores/auth.store';
import { apiRequest, ApiRequestError } from '../../src/api/client';
import { apiBasePath } from '../../src/api/config';

export default function Security() {
  const logout = useLogout();
  const revokeAllSessions = useRevokeAllSessions();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">Security</AppText>

        <SectionHeader>PASSWORD</SectionHeader>
        <Card>
          <View style={styles.field}>
            <AppText muted style={styles.label}>Current Password</AppText>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
          </View>

          <View style={styles.field}>
            <AppText muted style={styles.label}>New Password</AppText>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <AppText muted style={styles.hint}>
              Must be at least 12 characters
            </AppText>
          </View>

          <View style={styles.field}>
            <AppText muted style={styles.label}>Confirm New Password</AppText>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
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

        <SectionHeader>SESSIONS</SectionHeader>
        <Card>
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
            <AppText variant="heading" style={{ color: colors.success }}>
              Active
            </AppText>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
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
});