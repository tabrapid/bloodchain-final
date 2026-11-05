import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Key, LogOut, Smartphone } from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ConfirmationSheet,
  Divider,
  ListGroup,
  ListRow,
  PasswordField,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Stack,
  Surface,
  Text,
  iconSize,
  space,
  useDesign,
} from '../../src/design';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '../../src/hooks/useSessions';
import { useDonorProfile } from '../../src/hooks/useDonors';
import { clearAuthTokens } from '../../src/auth/storage';
import { useAuthStore } from '../../src/stores/auth.store';
import { apiRequest, ApiRequestError } from '../../src/api/client';
import { apiBasePath } from '../../src/api/config';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Takes the translator rather than calling a hook: this runs inside a row's
 * render, and a string built without it is stuck in the bundle's language.
 */
function formatRelativeTime(dateStr: string | undefined, t: TranslateFn): string {
  if (!dateStr) return t('common.unknown');
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return t('security.activeNow');
  if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
  return t('common.daysAgoShort', { count: Math.floor(diffHours / 24) });
}

type Session = { id: string; deviceName?: string | null; isCurrent?: boolean };

/**
 * Security, rebuilt for V2.
 *
 * Five system alerts used to carry this screen: two confirmations, two
 * outcomes and one failure. On Android they are unstyled OS dialogs stacked on
 * top of the app, and the one that mattered most -- "your password changed,
 * you have been signed out" -- was dismissed by the navigation that followed
 * it, so the donor arrived at the sign-in screen with no idea why.
 *
 * Confirmations are sheets now, and outcomes are said on the screen. The
 * password change no longer signs the donor out from under an alert: it
 * reports what happened and the donor signs in again when they are ready.
 */
export default function Security() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const { data: donorProfile } = useDonorProfile();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Session | null>(null);
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);

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
    setError(null);
    try {
      await apiRequest(`${apiBasePath}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChanged(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.error.message : t('security.passwordChangeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const signInAgain = async () => {
    await clearAuthTokens();
    clearAuth();
    router.replace('/(auth)/login');
  };

  const status = donorProfile?.donorStatus;

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('security.title')}
          size="large"
          subtitle={t('security.subtitle')}
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        {notice ? <Banner tone="success" title={notice} /> : null}
        {error ? <Banner tone="critical" title={error} /> : null}

        {/* --------------------------------------------------- password */}
        <Stack gap="md">
          <SectionHeader title={t('security.authentication')} />
          <Surface>
            {passwordChanged ? (
              <Stack gap="md">
                <Row gap="md">
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.success.soft,
                    }}
                  >
                    <Key size={iconSize.md} color={colors.success.base} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title">{t('security.passwordChanged')}</Text>
                    <Text variant="caption" tone="secondary">
                      {t('security.passwordChangedBody')}
                    </Text>
                  </View>
                </Row>
                <Button label={t('auth.login.submit')} onPress={() => void signInAgain()} />
              </Stack>
            ) : (
              <Stack gap="lg">
                <Row gap="md">
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.clinical.soft,
                    }}
                  >
                    <Key size={iconSize.md} color={colors.clinical.base} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title">{t('security.changePassword')}</Text>
                    {/* `At least {n} characters` was an English literal. */}
                    <Text variant="caption" tone="secondary">
                      {t('security.minimumLength', { count: MIN_PASSWORD_LENGTH })}
                    </Text>
                  </View>
                </Row>

                <PasswordField
                  label={t('security.currentPassword')}
                  placeholder={t('security.currentPasswordPlaceholder')}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  showLabel={t('security.a11yShowPassword')}
                  hideLabel={t('security.a11yHidePassword')}
                />
                <PasswordField
                  label={t('auth.resetPassword.newPassword')}
                  placeholder={t('security.newPasswordPlaceholder')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  error={lengthError}
                  showLabel={t('security.a11yShowPassword')}
                  hideLabel={t('security.a11yHidePassword')}
                />
                <PasswordField
                  label={t('auth.resetPassword.confirmPassword')}
                  placeholder={t('auth.resetPassword.confirmPassword')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  error={matchError}
                  showLabel={t('security.a11yShowPassword')}
                  hideLabel={t('security.a11yHidePassword')}
                />

                <Button
                  label={t('security.changePassword')}
                  disabled={!canSubmit}
                  loading={isChangingPassword}
                  onPress={() => void handleChangePassword()}
                />
              </Stack>
            )}
          </Surface>
        </Stack>

        {/* --------------------------------------------------- sessions */}
        <Stack gap="md">
          <SectionHeader title={t('security.activeSessions')} />
          {sessions && sessions.length > 0 ? (
            <Surface level="flat" padded="lg">
              {sessions.map((session, index) => (
                <View key={session.id}>
                  {index > 0 ? <Divider /> : null}
                  <Row gap="md" style={{ paddingVertical: space.md }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surfaceRaised,
                      }}
                    >
                      <Smartphone size={iconSize.md} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
                        <Text variant="body" numberOfLines={2} style={{ flexShrink: 1 }}>
                          {session.deviceName || session.deviceType || t('security.unknownDevice')}
                        </Text>
                        {/* The server decides this from the token the request
                            carried; without it every row offers the same
                            "revoke" and none of them says which one signs you
                            out of the device in your hand. */}
                        {session.isCurrent ? (
                          <Badge label={t('security.thisDevice')} tone="clinical" />
                        ) : null}
                      </Row>
                      <Text variant="caption" tone="tertiary">
                        {`${session.ipAddress ? `${session.ipAddress} · ` : ''}${formatRelativeTime(
                          session.lastUsedAt ?? session.createdAt,
                          t,
                        )}`}
                      </Text>
                    </View>
                    <Button
                      label={session.isCurrent ? t('security.signOut') : t('security.revoke')}
                      variant="secondary"
                      size="md"
                      block={false}
                      accessibilityLabel={t('security.a11yRevoke', {
                        device: session.deviceName ?? t('security.thisSession'),
                      })}
                      onPress={() => setRevoking(session)}
                    />
                  </Row>
                </View>
              ))}
            </Surface>
          ) : (
            /* A card drawn around the sentence "no other sessions". An empty
               list is not an object, and boxing the news that there is nothing
               here makes the nothing look like a something. */
            <Text variant="body" tone="secondary">
              {t('security.noOtherSessions')}
            </Text>
          )}

          <ListGroup
            rows={[
              <ListRow
                key="logout-all"
                icon={({ size, color }) => <LogOut size={size} color={color} />}
                iconTone="critical"
                title={t('security.logOutAll')}
                subtitle={t('security.logOutAllHint')}
                onPress={() => setConfirmingLogoutAll(true)}
              />,
            ]}
          />
        </Stack>

        {/* ----------------------------------------------- account status */}
        <Stack gap="md">
          <SectionHeader title={t('security.accountStatus')} />
          <ListGroup
            rows={[
              <ListRow
                key="status"
                title={t('security.donorStatus')}
                trailing={
                  <Badge
                    /*
                      Translated rather than de-underscored.
                      `status.replace(/_/g, ' ').toLowerCase()` put the raw
                      enum on the screen in English, which was survivable while
                      the values were ACTIVE and DEFERRED and stopped being so
                      the moment MEDICAL_REVIEW_REQUIRED existed: the one
                      status a donor most needs to understand was the one shown
                      in a language they may not read.
                    */
                    label={status ? t(`medical.donorStatus.${status}`) : t('common.unknown')}
                    tone={status === 'ACTIVE' ? 'success' : status ? 'warning' : 'neutral'}
                  />
                }
              />,
            ]}
          />
        </Stack>
      </Stack>

      {/*
        Revoking the current session signs the donor out of the phone in their
        hand -- a different thing from ending a session on a laptop they left
        at work, and it used to ask with exactly the same two sentences.
      */}
      <ConfirmationSheet
        visible={revoking !== null}
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          const session = revoking;
          setRevoking(null);
          if (session) revokeSession.mutate(session.id);
        }}
        title={
          revoking?.isCurrent
            ? t('security.signOutThisDeviceTitle')
            : t('security.revokeOtherSessionTitle', {
                device: revoking?.deviceName ?? t('security.unknownDevice'),
              })
        }
        description={
          revoking?.isCurrent
            ? t('security.signOutThisDeviceBody')
            : t('security.revokeSessionBody')
        }
        confirmLabel={revoking?.isCurrent ? t('security.signOut') : t('security.revoke')}
        cancelLabel={t('actions.cancel')}
        busy={revokeSession.isPending}
        destructive
      />

      <ConfirmationSheet
        visible={confirmingLogoutAll}
        onCancel={() => setConfirmingLogoutAll(false)}
        onConfirm={() => {
          setConfirmingLogoutAll(false);
          setError(null);
          revokeAllSessions.mutate(undefined, {
            onSuccess: () => setNotice(t('security.sessionsRevoked')),
            onError: () => setError(t('security.revokeFailed')),
          });
        }}
        title={t('security.logOutAllTitle')}
        description={t('security.logOutAllBody')}
        confirmLabel={t('security.logOutAllConfirm')}
        cancelLabel={t('actions.cancel')}
        busy={revokeAllSessions.isPending}
        destructive
      />
    </ScrollScreen>
  );
}
