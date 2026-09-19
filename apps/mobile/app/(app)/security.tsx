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
import { useTranslation } from '../../src/i18n';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Takes the translator rather than calling a hook: this runs inside a row's
 * render, and a string built without it is stuck in the bundle's language.
 */
function formatRelativeTime(
  dateStr: string | undefined,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  if (!dateStr) return t('common.unknown');
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return t('security.activeNow');
  if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
  return t('common.daysAgoShort', { count: Math.floor(diffHours / 24) });
}

export default function Security() {
  const { t } = useTranslation();
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
      ? t('validation.passwordTooShort')
      : undefined;
  const matchError =
    confirmPassword.length > 0 && confirmPassword !== newPassword
      ? t('security.passwordsDoNotMatch')
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

      Alert.alert(t('security.passwordChanged'), t('security.passwordChangedBody'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await clearAuthTokens();
      clearAuth();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert(
        t('security.passwordChangeFailed'),
        error instanceof ApiRequestError ? error.error.message : t('common.error'),
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  /**
   * Revoking the current session signs the donor out of the phone in their
   * hand -- a different thing from ending a session on a laptop they left at
   * work, and it used to ask with exactly the same two sentences. The row is
   * already labelled "Sign out" rather than "Revoke"; the confirmation now
   * matches it, so the destructive answer is never the one you reach for by
   * habit.
   */
  const handleRevokeSession = (session: { id: string; deviceName?: string | null; isCurrent?: boolean }) => {
    const title = session.isCurrent
      ? t('security.signOutThisDeviceTitle')
      : t('security.revokeOtherSessionTitle', {
          device: session.deviceName ?? t('security.unknownDevice'),
        });
    const body = session.isCurrent
      ? t('security.signOutThisDeviceBody')
      : t('security.revokeSessionBody');

    Alert.alert(title, body, [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: session.isCurrent ? t('security.signOut') : t('security.revoke'),
        style: 'destructive',
        onPress: () => revokeSession.mutate(session.id),
      },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      t('security.logOutAllTitle'),
      t('security.logOutAllBody'),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('security.logOutAllConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAllSessions.mutateAsync();
              Alert.alert(t('common.done'), t('security.sessionsRevoked'));
            } catch {
              Alert.alert(t('common.error'), t('security.revokeFailed'));
            }
          },
        },
      ],
    );
  };

  const status = donorProfile?.donorStatus;

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('security.title')} subtitle={t('security.subtitle')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader>{t('security.authentication')}</SectionHeader>
        <GlassCard>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <Key size={16} color={colors.onMuted.success} />
            </View>
            <View style={styles.cardHeadBody}>
              <AppText style={styles.cardHeadTitle}>{t('security.changePassword')}</AppText>
              <AppText style={styles.cardHeadMeta}>
                At least {MIN_PASSWORD_LENGTH} characters
              </AppText>
            </View>
          </View>

          <View style={styles.fields}>
            <AppTextInput
              label={t('security.currentPassword')}
              placeholder={t('security.currentPasswordPlaceholder')}
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
              label={t('auth.resetPassword.newPassword')}
              placeholder={t('security.newPasswordPlaceholder')}
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
              label={t('auth.resetPassword.confirmPassword')}
              placeholder={t('auth.resetPassword.confirmPassword')}
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
            {t('security.changePassword')}
          </AppButton>
        </GlassCard>

        <SectionHeader>{t('security.activeSessions')}</SectionHeader>
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
                      <View style={styles.sessionTitleRow}>
                        <AppText style={styles.sessionDevice}>
                          {session.deviceName || session.deviceType || t('security.unknownDevice')}
                        </AppText>
                        {/* The server decides this from the token the request
                            carried; without it every row offers the same
                            "revoke" and none of them says which one signs you
                            out of the device in your hand. */}
                        {session.isCurrent && (
                          <View style={styles.currentBadge}>
                            <AppText style={styles.currentBadgeText}>
                              {t('security.thisDevice')}
                            </AppText>
                          </View>
                        )}
                      </View>
                      <AppText style={styles.sessionMeta}>
                        {session.ipAddress ? `${session.ipAddress} · ` : ''}
                        {formatRelativeTime(session.lastUsedAt ?? session.createdAt, t)}
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => handleRevokeSession(session)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('security.a11yRevoke', {
                        device: session.deviceName ?? t('security.thisSession'),
                      })}
                    >
                      <AppText style={styles.revoke}>
                        {session.isCurrent ? t('security.signOut') : t('security.revoke')}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <AppText style={styles.emptyText}>{t('security.noOtherSessions')}</AppText>
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
                <AppText style={styles.dangerTitle}>{t('security.logOutAll')}</AppText>
                <AppText style={styles.sessionMeta}>{t('security.logOutAllHint')}</AppText>
              </View>
            </View>
          </GlassCard>
        </Pressable>

        <SectionHeader>{t('security.accountStatus')}</SectionHeader>
        <GlassCard style={styles.compactCard}>
          <View style={styles.statusRow}>
            <AppText style={styles.statusLabel}>{t('security.donorStatus')}</AppText>
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
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={shown ? t('security.a11yHidePassword') : t('security.a11yShowPassword')}
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
    sessionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    currentBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.successMuted,
    },
    currentBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.onMuted.success,
    },
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
