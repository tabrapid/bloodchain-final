import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, IconButton, Screen } from '../../src/components';
import { useRegister, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { layout, spacing, useTheme } from '../../src/theme';
import { BRAND_NAME } from '../../src/brand';
import { useTranslation } from '../../src/i18n';

export default function Register() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const registerUser = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await registerUser.mutateAsync(data);
      router.replace({ pathname: '/(auth)/check-email', params: { email: data.email } });
    } catch (err: unknown) {
      setServerError(getAuthErrorMessage(err));
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
          {t('auth.register.title')}
        </AppText>
        <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
          {t('auth.register.subtitle', { brand: BRAND_NAME })}
        </AppText>

        {/*
          First and last name stay separate fields. The reference collapses
          them into one "Full name", but `registerSchema` validates them apart,
          and splitting a typed full name back into two is guesswork on any
          name that is not exactly two words.

          Side by side, though, and without the person icon each carried: four
          full-width slabs down the screen was a longer form than this actually
          is, and a name field does not need an icon to say what it is.
        */}
        <View style={{ flexDirection: 'row', gap: layout.cardGap, marginBottom: layout.cardGap }}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <AppTextInput
                label={t('auth.register.firstName')}
                placeholder={t('auth.register.firstNamePlaceholder')}
                autoComplete="given-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => lastNameRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <AppTextInput
                ref={lastNameRef}
                label={t('auth.register.lastName')}
                placeholder={t('auth.register.lastNamePlaceholder')}
                autoComplete="family-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <AppTextInput
              ref={emailRef}
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

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AppTextInput
              ref={passwordRef}
              label={t('auth.fields.password')}
              placeholder={t('auth.fields.passwordPlaceholder')}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
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

        {/* The same sentence, in the same place, as the reset screen. The rule
            is one rule; two screens describing it differently is how a person
            concludes the second one is stricter. */}
        <AppText muted style={{ fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.lg }}>
{t('auth.fields.passwordPolicy')}
        </AppText>

        {serverError && (
          <AppText accessibilityRole="alert" style={{ color: colors.danger, marginBottom: spacing.md }}>
            {serverError}
          </AppText>
        )}

        <AppButton
          gradient
          trailingIcon={ArrowRight}
          accessibilityRole="button"
          accessibilityLabel={t('auth.welcome.a11yCreateAccount')}
          style={{ height: 54 }}
          onPress={onSubmit}
          disabled={registerUser.isPending || formState.isSubmitting}
          loading={registerUser.isPending}
        >
          {t('auth.register.submit')}
        </AppButton>

      </View>

      {/* The alternate path sits at the foot of the screen, not directly under
          the form. Stacked tight beneath the primary it competed with it, and
          left the bottom of the screen empty besides. */}
      <View style={{ flex: 1, minHeight: spacing.xl }} />

      <View>
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
            {t('auth.register.haveAccount')}
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Near-white on a light film, not the variant's rose on a dark tile.
            Rose text at this weight on `surfaceElevated` is the weakest
            contrast on the screen, and it read as disabled next to the CTA. */}
        <AppButton
          variant="secondary"
          textColor={colors.text}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel={t('auth.welcome.a11ySignIn')}
          style={{
            height: 54,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        >
          {t('auth.register.signIn')}
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
