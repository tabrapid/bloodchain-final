import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowRight, Mail, MailCheck } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@bloodchain/validation';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  Screen,
  ScreenHeader,
  Stack,
  Text,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../src/design';
import { useRequestPasswordReset, getRecoveryErrorMessage } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/i18n';

/**
 * Step one of account recovery: ask for the link.
 *
 * The server answers identically whether or not the address is registered, and
 * this screen has to keep that promise. So there is no "no account with that
 * email" state and no branch on the response body -- a successful request shows
 * the same confirmation for every address, phrased so it is honest either way
 * ("if an account exists"). Anything more helpful would hand an attacker a way
 * to test which addresses are registered, which is precisely what the API
 * declines to do.
 */
export default function ForgotPassword() {
  const { colors } = useDesign();
  const { t } = useTranslation();
  const request = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await request.mutateAsync(data.email);
      setSentTo(data.email);
    } catch (err: unknown) {
      setServerError(getRecoveryErrorMessage(err));
    }
  });

  const busy = request.isPending || formState.isSubmitting;

  if (sentTo) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Stack gap="xl" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.lg,
                backgroundColor: colors.clinical.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MailCheck size={iconSize.xl} color={colors.clinical.base} strokeWidth={1.5} />
            </View>

            <Stack gap="sm" style={{ alignItems: 'center' }}>
              <Text variant="h1" align="center" accessibilityRole="header">
                {t('auth.forgotPassword.sentTitle')}
              </Text>
              {/* "If an account exists" is not hedging -- it is the only true
                  thing this screen can say, because the server does not tell
                  it. */}
              <Text variant="body" tone="secondary" align="center">
                {t('auth.forgotPassword.sentBody', { email: sentTo })}
              </Text>
            </Stack>

            <Stack gap="md" style={{ alignSelf: 'stretch' }}>
              <Button label={t('auth.checkEmail.backToSignIn')} onPress={() => router.replace('/(auth)/login')} />

              <TextAction
                label={t('auth.forgotPassword.useDifferentEmail')}
                accessibilityLabel={t('auth.forgotPassword.a11yUseDifferentEmail')}
                disabled={busy}
                tone="clinical"
                onPress={() => {
                  setSentTo(null);
                  setServerError(null);
                }}
              />

              {/* Reachable without leaving and coming back: someone who has
                  the link already should not have to guess where the next
                  screen is. */}
              <TextAction
                label={t('auth.forgotPassword.haveCode')}
                accessibilityLabel={t('auth.forgotPassword.a11yHaveCode')}
                tone="tertiary"
                onPress={() => router.push('/(auth)/reset-password')}
              />
            </Stack>
          </Stack>
        </View>
      </Screen>
    );
  }

  return (
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      <Stack gap="xl">
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="display" accessibilityRole="header">
            {t('auth.forgotPassword.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.forgotPassword.subtitle')}
          </Text>
        </View>

        <Stack gap="lg">
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                label={t('auth.fields.email')}
                placeholder={t('auth.fields.emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                autoFocus
                leading={<Mail size={iconSize.md} color={colors.textTertiary} />}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
                editable={!busy}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {serverError ? <Banner tone="critical" title={serverError} /> : null}

          <Button
            label={t('auth.forgotPassword.submit')}
            accessibilityLabel={t('auth.forgotPassword.a11ySubmit')}
            onPress={onSubmit}
            disabled={busy}
            loading={request.isPending}
            icon={({ size, color }) => <ArrowRight size={size} color={color} />}
          />
        </Stack>

        <View style={{ flex: 1, minHeight: space.xl }} />

        <Stack gap="sm">
          <TextAction
            label={`${t('auth.forgotPassword.haveCode')} ${t('auth.forgotPassword.enterIt')}`}
            accessibilityLabel={t('auth.forgotPassword.a11yHaveCode')}
            tone="tertiary"
            onPress={() => router.push('/(auth)/reset-password')}
          />

          {/* Recovery by SMS, for the donors who have a number and no inbox.
              It reuses the same reset token the emailed link carries, so it is
              the same flow with a different first step -- not a second, weaker
              way in. */}
          <TextAction
            label={t('auth.phone.usePhone')}
            accessibilityLabel={t('auth.phone.a11ySubmit')}
            tone="clinical"
            onPress={() => router.push({ pathname: '/(auth)/phone', params: { purpose: 'PASSWORD_RESET' } })}
          />

          <TextAction
            label={t('auth.checkEmail.backToSignIn')}
            accessibilityLabel={t('auth.checkEmail.backToSignIn')}
            tone="primary"
            onPress={() => router.replace('/(auth)/login')}
          />
        </Stack>
      </Stack>
    </FormScreen>
  );
}

/**
 * A centred text button.
 *
 * Four of these sit at the foot of this screen, and hand-rolling each one is
 * how they end up with four different heights and three different opacities.
 */
function TextAction({
  label,
  accessibilityLabel,
  tone,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  tone: 'primary' | 'tertiary' | 'clinical';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={12}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <Text variant={tone === 'tertiary' ? 'caption' : 'bodyStrong'} tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}
