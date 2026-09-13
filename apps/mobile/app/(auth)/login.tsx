import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { normalizePhone } from '@bloodchain/validation';
import { z } from 'zod';
import { AppButton, AppText, AppTextInput, IconButton, PhoneInput, Screen } from '../../src/components';
import { useLogin } from '../../src/hooks/useAuth';
import { apiErrorCode, apiErrorMessage } from '../../src/api/errors';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { layout, spacing, useTheme } from '../../src/theme';
import { BRAND_NAME } from '../../src/brand';
import { useTranslation } from '../../src/i18n';

export default function Login() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  /**
   * Which identifier this donor is signing in with.
   *
   * Phone first, because that is what a donor in Uzbekistan knows about
   * themselves; email is one tap away and stays the default for staff, who
   * arrive here from a console that mailed them a link. It is one account
   * either way -- the same password, the same sessions -- so this switch
   * changes a field, not a flow.
   */
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');

  // Only the password is validated here. An identifier is checked by whichever
  // field is on screen, and the server has the last word on both.
  const { control, handleSubmit, formState } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(
      z.object({
        email: z.union([z.literal(''), z.string().email('validation.emailInvalid')]),
        password: z.string().min(1, 'validation.passwordRequired'),
      }),
    ),
    defaultValues: { email: '', password: '' },
  });

  const phone = normalizePhone(`+998${phoneDigits}`);

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    setUnverifiedEmail(null);

    if (method === 'phone' && !phone) {
      setServerError(t('validation.phoneUzbek'));
      return;
    }

    try {
      const result = await login.mutateAsync(
        method === 'phone'
          ? { phone: phone!, password: data.password }
          : { email: data.email, password: data.password },
      );
      router.replace(getPostAuthRoute(result.user.roles));
    } catch (err: unknown) {
      setServerError(apiErrorMessage(err, t));
      // An account whose contact was never confirmed can finish the job from
      // the check-email screen -- but only if it has an address to send to.
      if (apiErrorCode(err) === 'AUTH_CONTACT_NOT_VERIFIED' && method === 'email') {
        setUnverifiedEmail(data.email);
      }
    }
  });

  return (
    <Screen>
      <IconButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('auth.a11y.goBack')}
      />

      <View style={{ marginTop: spacing.xl }}>
        {/* The auth headlines are the one place the reference goes bigger and
            heavier than the standard screen title. */}
        <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
          {t('auth.login.title')}
        </AppText>
        <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
          {t('auth.login.subtitle', { brand: BRAND_NAME })}
        </AppText>

        {method === 'phone' ? (
          <PhoneInput
            label={t('auth.phone.label')}
            placeholder={t('auth.phone.placeholder')}
            accessibilityLabel={t('auth.phone.a11yField')}
            // The return key walks the form instead of dismissing the
            // keyboard, which on a two-field form is the whole interaction.
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            wrapperStyle={{ marginBottom: layout.cardGap }}
            value={phoneDigits}
            onChangeDigits={(next) => {
              setPhoneDigits(next);
              if (serverError) setServerError(null);
            }}
          />
        ) : (
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <AppTextInput
                label={t('auth.fields.email')}
                placeholder={t('auth.fields.emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                leading={<Mail size={19} color={colors.textMuted} />}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ marginBottom: layout.cardGap }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        )}

        {/* One line, not a segmented control: there is a default that is right
            for almost everyone, and the other option only has to be findable. */}
        <Pressable
          onPress={() => {
            setMethod((current) => (current === 'phone' ? 'email' : 'phone'));
            setServerError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={method === 'phone' ? t('auth.phone.useEmail') : t('auth.phone.usePhone')}
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            minHeight: 44,
            marginTop: -spacing.xs,
            marginBottom: spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          {method === 'phone' ? (
            <Mail size={14} color={colors.primary} />
          ) : (
            <Phone size={14} color={colors.primary} />
          )}
          <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
            {method === 'phone' ? t('auth.phone.useEmail') : t('auth.phone.usePhone')}
          </AppText>
        </Pressable>

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AppTextInput
              ref={passwordRef}
              label={t('auth.fields.password')}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              leading={<Lock size={19} color={colors.textMuted} />}
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              wrapperStyle={{ marginBottom: spacing.lg }}
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

        {/* Sits with the password field it belongs to, right-aligned, above
            the CTA -- the one place a person looks after mistyping a password
            for the second time. */}
        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          accessibilityRole="button"
          accessibilityLabel={t('auth.login.a11yForgotPassword')}
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: 'flex-end',
            minHeight: 44,
            justifyContent: 'center',
            marginTop: -spacing.sm,
            marginBottom: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
            {t('auth.login.forgotPassword')}
          </AppText>
        </Pressable>

        {serverError && (
          <AppText accessibilityRole="alert" style={{ color: colors.danger, marginBottom: spacing.md }}>
            {serverError}
          </AppText>
        )}

        <AppButton
          gradient
          trailingIcon={ArrowRight}
          accessibilityRole="button"
          accessibilityLabel={t('auth.welcome.a11ySignIn')}
          style={{ height: 54 }}
          onPress={onSubmit}
          disabled={login.isPending || formState.isSubmitting}
          loading={login.isPending}
        >
          {t('auth.login.submit')}
        </AppButton>

        {unverifiedEmail && (
          <AppButton
            variant="ghost"
            style={{ marginTop: spacing.md }}
            onPress={() =>
              router.push({ pathname: '/(auth)/check-email', params: { email: unverifiedEmail } })
            }
          >
            {t('auth.login.resendVerification')}
          </AppButton>
        )}

      </View>

      {/* The alternate path sits at the foot of the screen, not directly under
          the form. Stacked tight beneath the primary it competed with it, and
          left the bottom third of the screen empty besides. */}
      <View style={{ flex: 1, minHeight: spacing.xl }} />

      <View>
        {/* A labelled rule, not a third stacked button with a sentence over it:
            the label *is* the separator, which is what keeps "Create Account"
            reading as the other path rather than a second way to sign in. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <AppText muted style={{ fontSize: 13 }}>
            {t('auth.login.noAccount')}
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Near-white on a light film, not the variant's rose on a dark tile.
            Rose text at this weight on `surfaceElevated` is the weakest
            contrast on the screen, and it read as disabled next to the CTA. */}
        <AppButton
          variant="secondary"
          textColor={colors.text}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel={t('auth.welcome.a11yCreateAccount')}
          style={{
            height: 54,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        >
          {t('auth.login.createAccount')}
        </AppButton>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: spacing.lg,
          }}
        >
          <ShieldCheck size={15} color={colors.onMuted.success} />
          <AppText muted style={{ fontSize: 12 }}>
            {t('auth.login.secure')}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
