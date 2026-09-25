import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@bloodchain/validation';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  Row,
  ScreenHeader,
  Stack,
  Text,
  iconSize,
  space,
  useDesign,
} from '../../src/design';
import { useRegister, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { BRAND_NAME } from '../../src/brand';
import { useTranslation } from '../../src/i18n';

/**
 * Email sign-up.
 *
 * Phone-first is the primary path (see `phone.tsx`); this stays because every
 * account created before that sprint has an email, and some donors would
 * rather use one.
 */
export default function Register() {
  const { colors } = useDesign();
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

  const busy = registerUser.isPending || formState.isSubmitting;

  return (
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      {/*
        The spacer below can only push the alternate path to the foot of the
        screen if something above it is allowed to grow. Without this flex, the
        Stack sized itself to its content and the spacer collapsed to its 24pt
        minimum -- so "Create account" sat directly under the form with the rest
        of the page empty beneath it.
      */}
      <Stack gap="xl" style={{ flex: 1 }}>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="display" accessibilityRole="header">
            {t('auth.register.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.register.subtitle', { brand: BRAND_NAME })}
          </Text>
        </View>

        <Stack gap="lg">
          {/*
            First and last name stay separate fields. The reference collapses
            them into one "Full name", but `registerSchema` validates them
            apart, and splitting a typed full name back into two is guesswork
            on any name that is not exactly two words.

            Side by side, though, and without the person icon each carried:
            four full-width slabs down the screen was a longer form than this
            actually is, and a name field does not need an icon to say what it
            is.
          */}
          <Row gap="md" align="flex-start">
            <Controller
              control={control}
              name="firstName"
              render={({ field, fieldState }) => (
                <Field
                  label={t('auth.register.firstName')}
                  placeholder={t('auth.register.firstNamePlaceholder')}
                  autoComplete="given-name"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  containerStyle={{ flex: 1 }}
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
                <Field
                  ref={lastNameRef}
                  label={t('auth.register.lastName')}
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  autoComplete="family-name"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  containerStyle={{ flex: 1 }}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Row>

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                ref={emailRef}
                label={t('auth.fields.email')}
                placeholder={t('auth.fields.emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                leading={<Mail size={iconSize.md} color={colors.textTertiary} />}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
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
              <Field
                ref={passwordRef}
                label={t('auth.fields.password')}
                placeholder={t('auth.fields.passwordPlaceholder')}
                // The same sentence, in the same place, as the reset screen.
                // The rule is one rule; two screens describing it differently
                // is how a person concludes the second one is stricter.
                hint={t('auth.fields.passwordPolicy')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                leading={<Lock size={iconSize.md} color={colors.textTertiary} />}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                trailing={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={iconSize.md} color={colors.textTertiary} />
                    ) : (
                      <Eye size={iconSize.md} color={colors.textTertiary} />
                    )}
                  </Pressable>
                }
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {serverError ? <Banner tone="critical" title={serverError} /> : null}

          <Button
            label={t('auth.register.submit')}
            accessibilityLabel={t('auth.welcome.a11yCreateAccount')}
            onPress={onSubmit}
            disabled={busy}
            loading={registerUser.isPending}
            icon={({ size, color }) => <ArrowRight size={size} color={color} />}
          />
        </Stack>

        {/* The alternate path sits at the foot of the screen, not directly
            under the form. Stacked tight beneath the primary it competed with
            it, and left the bottom of the screen empty besides. */}
        <View style={{ flex: 1, minHeight: space.xl }} />

        <Stack gap="lg">
          <Row gap="md">
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <Text variant="caption" tone="tertiary">
              {t('auth.register.haveAccount')}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </Row>

          <Button
            label={t('auth.register.signIn')}
            accessibilityLabel={t('auth.welcome.a11ySignIn')}
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />

          <Row gap="sm" style={{ justifyContent: 'center' }}>
            <ShieldCheck size={iconSize.sm} color={colors.success.text} />
            <Text variant="caption" tone="tertiary">
              {t('auth.login.secure')}
            </Text>
          </Row>
        </Stack>
      </Stack>
    </FormScreen>
  );
}
