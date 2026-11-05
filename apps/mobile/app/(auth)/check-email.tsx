import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { Banner, Button, LinkButton, Screen, Stack, Text, iconSize, radius, useDesign } from '../../src/design';
import { useResendVerification, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/i18n';

/**
 * The pause between registering and confirming.
 *
 * One job: say where to look, and offer to send it again. The screen exists
 * because an unconfirmed account is a dead end otherwise -- the donor has no
 * way back in and no way to ask for another mail.
 */
export default function CheckEmail() {
  const { colors } = useDesign();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const resend = useResendVerification();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onResend = async () => {
    if (!params.email) return;
    setError(null);
    setSent(false);
    try {
      await resend.mutateAsync(params.email);
      setSent(true);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    }
  };

  const canResend = Boolean(params.email) && !resend.isPending;

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Stack gap="xl" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              backgroundColor: colors.clinical.soft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={iconSize.xl} color={colors.clinical.base} strokeWidth={1.5} />
          </View>

          <Stack gap="sm" style={{ alignItems: 'center' }}>
            <Text variant="h1" align="center" accessibilityRole="header">
              {t('auth.checkEmail.title')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {params.email
                ? t('auth.checkEmail.bodyWithEmail', { email: params.email })
                : t('auth.checkEmail.body')}
            </Text>
          </Stack>

          {sent ? <Banner tone="success" title={t('auth.checkEmail.resent')} style={{ alignSelf: 'stretch' }} /> : null}
          {error ? <Banner tone="critical" title={error} style={{ alignSelf: 'stretch' }} /> : null}

          <Stack gap="md" style={{ alignSelf: 'stretch' }}>
            <Button label={t('auth.checkEmail.backToSignIn')} onPress={() => router.replace('/(auth)/login')} />

            <LinkButton
              label={resend.isPending ? t('common.sending') : t('auth.checkEmail.resend')}
              disabled={!canResend}
              accessibilityState={{ disabled: !canResend, busy: resend.isPending }}
              onPress={onResend}
            />
          </Stack>
        </Stack>
      </View>
    </Screen>
  );
}
