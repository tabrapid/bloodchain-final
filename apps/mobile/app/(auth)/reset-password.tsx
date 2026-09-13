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
import { useTranslation } from '../../src/i18n';

/**
 * The form, which is not the request body.
 *
 * `resetPasswordSchema` in @bloodchain/validation mirrors the server's DTO and
 * is the contract; the confirmation field exists only to catch a typo before it
 * becomes a password nobody knows, so it is validated here.
 */
/**
 * Messages are catalogue keys, resolved at render by `t`.
 *
 * The schema is built once at module load, where there is no locale, so it
 * cannot hold translated text. A key that no catalogue has -- the password
 * policy messages, which come from @bloodchain/validation in English -- passes
 * through `t` unchanged, so nothing is lost while those are still untranslated.
 */
const formSchema = z
  .object({
    token: z.string().trim().min(1, 'auth.errors.codeRequired').max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'auth.errors.confirmRequired'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'auth.errors.passwordsDoNotMatch',
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
  const { t } = useTranslation();
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
            {t('auth.resetPassword.doneTitle')}
          </AppText>

          {/* Said plainly, because it is a consequence the user will otherwise
              meet as an unexplained sign-out on their other device. */}
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            {t('auth.resetPassword.doneBody')}
          </AppText>

          <AppButton
            gradient
            accessibilityRole="button"
            accessibilityLabel={t('auth.resetPassword.a11yGoToSignIn')}
            style={{ alignSelf: 'stretch', height: 54 }}
            onPress={() => router.replace('/(auth)/login')}
          >
            {t('auth.resetPassword.goToSignIn')}
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
            {t('auth.resetPassword.rejectedTitle')}
          </AppText>

          {/* The server will not say which of the three it is, and guessing
              would be worse than saying so: all three have the same remedy. */}
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
{t('auth.resetPassword.rejectedBody')}
          </AppText>

          <AppButton
            gradient
            accessibilityRole="button"
            accessibilityLabel={t('auth.resetPassword.a11yRequestNewLink')}
            style={{ alignSelf: 'stretch', height: 54 }}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            {t('auth.resetPassword.requestNewLink')}
          </AppButton>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.checkEmail.backToSignIn')}
            hitSlop={8}
            style={({ pressed }) => ({
              marginTop: 20,
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
              {t('auth.checkEmail.backToSignIn')}
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
          accessibilityLabel={t('auth.a11y.goBack')}
        />

        <View style={{ marginTop: spacing.xl }}>
          <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            {t('auth.resetPassword.title')}
          </AppText>
          <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
            {linkToken
              ? t('auth.resetPassword.subtitleFromLink')
              : t('auth.resetPassword.subtitleManual')}
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
                  label={t('auth.resetPassword.code')}
                  placeholder={t('auth.resetPassword.codePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  leading={<KeyRound size={19} color={colors.textMuted} />}
                  returnKeyType="next"
                  editable={!busy}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
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
                label={t('auth.resetPassword.newPassword')}
                placeholder={t('auth.fields.passwordPlaceholder')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                autoFocus={Boolean(linkToken)}
                leading={<Lock size={19} color={colors.textMuted} />}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!busy}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ marginBottom: layout.cardGap }}
                trailing={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
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
                label={t('auth.resetPassword.confirmPassword')}
                placeholder={t('auth.resetPassword.confirmPlaceholder')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                leading={<Lock size={19} color={colors.textMuted} />}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!busy}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ marginBottom: spacing.md }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {/* The policy in advance, rather than as four separate rejections. */}
          <AppText muted style={{ fontSize: 12, marginBottom: spacing.lg }}>
{t('auth.fields.passwordPolicy')}
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
            accessibilityLabel={t('auth.resetPassword.a11ySubmit')}
            style={{ height: 54 }}
            onPress={onSubmit}
            disabled={busy}
            loading={reset.isPending}
          >
            {t('auth.resetPassword.submit')}
          </AppButton>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel={t('auth.checkEmail.backToSignIn')}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>
            {t('auth.checkEmail.backToSignIn')}
          </AppText>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}
