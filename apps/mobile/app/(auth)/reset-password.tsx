import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { CheckCircle2, ChevronLeft, Eye, EyeOff, KeyRound, Lock, LinkIcon } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { strongPasswordSchema } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, IconButton, Screen } from '../../src/components';
import {
  useResetPassword,
  getRecoveryErrorMessage,
  isRejectedResetToken,
} from '../../src/hooks/useAuth';
import { layout, spacing, useTheme } from '../../src/theme';

/**
 * The form, which is not the request body.
 *
 * `resetPasswordSchema` in @bloodchain/validation mirrors the server's DTO and
 * is the contract; the confirmation field exists only to catch a typo before it
 * becomes a password nobody knows, so it is validated here.
 */
const formSchema = z
  .object({
    token: z.string().trim().min(1, 'Paste the code from your reset email').max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Re-enter the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof formSchema>;

/**
 * Step two of account recovery: spend the link and set a new password.
 *
 * Reached two ways. From the email's deep link
 * (`donor://reset-password?token=…`) the token arrives as a route param and the
 * code field stays hidden -- the user has already proved they read the mail.
 * Opened directly, the field is shown so a code can be pasted, which is what
 * happens when the mail was opened on a laptop and the phone is where the app
 * lives.
 */
export default function ResetPassword() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = typeof params.token === 'string' ? params.token : '';
  const reset = useResetPassword();

  const [serverError, setServerError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { token: linkToken, newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setTokenRejected(false);
    try {
      await reset.mutateAsync({ token: values.token.trim(), newPassword: values.newPassword });
      setDone(true);
    } catch (err: unknown) {
      // A refused token is not a form error -- there is nothing to correct on
      // this screen, so the whole screen changes rather than showing a red line
      // under a field the user cannot fix.
      if (isRejectedResetToken(err)) {
        setTokenRejected(true);
        return;
      }
      setServerError(getRecoveryErrorMessage(err));
    }
  });

  const busy = reset.isPending || formState.isSubmitting;

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.successMuted,
              borderWidth: 1,
              borderColor: `${colors.onMuted.success}4D`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <CheckCircle2 size={36} color={colors.onMuted.success} strokeWidth={1.5} />
          </View>

          <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
            Password updated
          </AppText>

          {/* Said plainly, because it is a consequence the user will otherwise
              meet as an unexplained sign-out on their other device. */}
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            You have been signed out everywhere else. Sign in with your new password to continue.
          </AppText>

          <AppButton
            gradient
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
            style={{ alignSelf: 'stretch', height: 54 }}
            onPress={() => router.replace('/(auth)/login')}
          >
            Sign in
          </AppButton>
        </View>
      </Screen>
    );
  }

  if (tokenRejected) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.dangerMuted,
              borderWidth: 1,
              borderColor: `${colors.onMuted.danger}4D`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <LinkIcon size={36} color={colors.onMuted.danger} strokeWidth={1.5} />
          </View>

          <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
            This link no longer works
          </AppText>

          {/* The server will not say which of the three it is, and guessing
              would be worse than saying so: all three have the same remedy. */}
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            Reset links can be used once and expire within the hour. Request a new one and open the
            most recent email.
          </AppText>

          <AppButton
            gradient
            accessibilityRole="button"
            accessibilityLabel="Request a new reset link"
            style={{ alignSelf: 'stretch', height: 54 }}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            Request a new link
          </AppButton>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            hitSlop={8}
            style={({ pressed }) => ({
              marginTop: 20,
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
              Back to sign in
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
            New password
          </AppText>
          <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
            {linkToken
              ? 'Choose a new password for your account. Signing in elsewhere will stop working.'
              : 'Paste the code from your reset email, then choose a new password.'}
          </AppText>

          {/* Hidden when the deep link supplied it: showing a 64-character
              string the user cannot meaningfully check is noise, and an
              editable field invites breaking a token that already works. */}
          {!linkToken && (
            <Controller
              control={control}
              name="token"
              render={({ field, fieldState }) => (
                <AppTextInput
                  label="Reset code"
                  placeholder="Paste the code from your email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  leading={<KeyRound size={19} color={colors.textMuted} />}
                  returnKeyType="next"
                  editable={!busy}
                  error={fieldState.error?.message}
                  wrapperStyle={{ marginBottom: layout.cardGap }}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}

          <Controller
            control={control}
            name="newPassword"
            render={({ field, fieldState }) => (
              <AppTextInput
                label="New password"
                placeholder="At least 12 characters"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                autoFocus={Boolean(linkToken)}
                leading={<Lock size={19} color={colors.textMuted} />}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!busy}
                error={fieldState.error?.message}
                wrapperStyle={{ marginBottom: layout.cardGap }}
                trailing={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={colors.textMuted} />
                    ) : (
                      <Eye size={20} color={colors.textMuted} />
                    )}
                  </Pressable>
                }
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <AppTextInput
                ref={confirmRef}
                label="Confirm new password"
                placeholder="Type it again"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                leading={<Lock size={19} color={colors.textMuted} />}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!busy}
                error={fieldState.error?.message}
                wrapperStyle={{ marginBottom: spacing.md }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {/* The policy in advance, rather than as four separate rejections. */}
          <AppText muted style={{ fontSize: 12, marginBottom: spacing.lg }}>
            Use at least 12 characters with an uppercase and a lowercase letter, a number and a
            special character.
          </AppText>

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
            accessibilityRole="button"
            accessibilityLabel="Set new password"
            style={{ height: 54 }}
            onPress={onSubmit}
            disabled={busy}
            loading={reset.isPending}
          >
            Set new password
          </AppButton>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

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
      </KeyboardAvoidingView>
    </Screen>
  );
}
