import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { ArrowRight, ChevronLeft, Mail, MailCheck } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, IconButton, Screen } from '../../src/components';
import { useRequestPasswordReset, getRecoveryErrorMessage } from '../../src/hooks/useAuth';
import { layout, spacing, useTheme } from '../../src/theme';

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
  const { colors } = useTheme();
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.secondaryMuted,
              borderWidth: 1,
              borderColor: `${colors.onMuted.secondary}4D`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <MailCheck size={36} color={colors.onMuted.secondary} strokeWidth={1.5} />
          </View>

          <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
            Check your email
          </AppText>

          {/* "If an account exists" is not hedging -- it is the only true thing
              this screen can say, because the server does not tell it. */}
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            If an account exists for {sentTo}, a reset link is on its way. The link can be used once
            and expires within the hour.
          </AppText>

          <AppButton onPress={() => router.replace('/(auth)/login')} style={{ alignSelf: 'stretch' }}>
            Back to sign in
          </AppButton>

          <Pressable
            onPress={() => {
              setSentTo(null);
              setServerError(null);
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Use a different email address"
            hitSlop={8}
            style={({ pressed }) => ({
              marginTop: 20,
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed || busy ? 0.6 : 1,
            })}
          >
            <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
              Use a different email
            </AppText>
          </Pressable>

          {/* Reachable without leaving and coming back: someone who has the
              link already should not have to guess where the next screen is. */}
          <Pressable
            onPress={() => router.push('/(auth)/reset-password')}
            accessibilityRole="button"
            accessibilityLabel="I already have a reset code"
            hitSlop={8}
            style={({ pressed }) => ({
              marginTop: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText muted style={{ fontSize: 13 }}>
              I already have a reset code
            </AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <IconButton
          icon={ChevronLeft}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        />

        <View style={{ marginTop: spacing.xl }}>
          <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            Reset password
          </AppText>
          <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
            Enter the email address you signed up with and we&apos;ll send you a link to set a new
            password.
          </AppText>

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <AppTextInput
                label="Email address"
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                autoFocus
                leading={<Mail size={19} color={colors.textMuted} />}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
                editable={!busy}
                error={fieldState.error?.message}
                wrapperStyle={{ marginBottom: layout.cardGap }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {serverError && (
            <AppText
              accessibilityRole="alert"
              style={{ color: colors.danger, marginBottom: spacing.md }}
            >
              {serverError}
            </AppText>
          )}

          <AppButton
            gradient
            trailingIcon={ArrowRight}
            accessibilityRole="button"
            accessibilityLabel="Send password reset link"
            style={{ height: 54 }}
            onPress={onSubmit}
            disabled={busy}
            loading={request.isPending}
          >
            Send reset link
          </AppButton>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

        <View>
          <Pressable
            onPress={() => router.push('/(auth)/reset-password')}
            accessibilityRole="button"
            accessibilityLabel="Enter a reset code you already have"
            hitSlop={8}
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText muted style={{ fontSize: 13 }}>
              Already have a reset code?{' '}
              <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
                Enter it
              </AppText>
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            hitSlop={8}
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>
              Back to sign in
            </AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
