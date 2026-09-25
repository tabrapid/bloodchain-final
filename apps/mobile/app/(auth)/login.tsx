import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { normalizePhone } from '@bloodchain/validation';
import { z } from 'zod';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  PhoneField,
  Row,
  ScreenHeader,
  Stack,
  Text,
  iconSize,
  space,
  useDesign,
} from '../../src/design';
import { useLogin } from '../../src/hooks/useAuth';
import { apiErrorCode, apiErrorMessage } from '../../src/api/errors';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { BRAND_NAME } from '../../src/brand';
import { useTranslation } from '../../src/i18n';

export default function Login() {
  const { colors } = useDesign();
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

  const busy = login.isPending || formState.isSubmitting;

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
            {t('auth.login.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.login.subtitle', { brand: BRAND_NAME })}
          </Text>
        </View>

        <Stack gap="lg">
          {method === 'phone' ? (
            <PhoneField
              prefix="+998"
              label={t('auth.phone.label')}
              placeholder={t('auth.phone.placeholder')}
              accessibilityLabel={t('auth.phone.a11yField')}
              // The return key walks the form instead of dismissing the
              // keyboard, which on a two-field form is the whole interaction.
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={phoneDigits}
              onChangeText={(next) => {
                setPhoneDigits(next.replace(/\D/g, '').slice(0, 9));
                if (serverError) setServerError(null);
              }}
            />
          ) : (
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
          )}

          {/* One line, not a segmented control: there is a default that is
              right for almost everyone, and the other option only has to be
              findable. */}
          <Pressable
            onPress={() => {
              setMethod((current) => (current === 'phone' ? 'email' : 'phone'));
              setServerError(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={method === 'phone' ? t('auth.phone.useEmail') : t('auth.phone.usePhone')}
            hitSlop={12}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              minHeight: 44,
              marginTop: -space.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {method === 'phone' ? (
              <Mail size={iconSize.sm} color={colors.clinical.text} />
            ) : (
              <Phone size={iconSize.sm} color={colors.clinical.text} />
            )}
            <Text variant="label" tone="clinical">
              {method === 'phone' ? t('auth.phone.useEmail') : t('auth.phone.usePhone')}
            </Text>
          </Pressable>

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Field
                ref={passwordRef}
                label={t('auth.fields.password')}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoComplete="password"
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

          {/* Sits with the password field it belongs to, right-aligned -- the
              one place a person looks after mistyping a password twice. */}
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.login.a11yForgotPassword')}
            hitSlop={12}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              minHeight: 44,
              justifyContent: 'center',
              marginTop: -space.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text variant="label" tone="clinical">
              {t('auth.login.forgotPassword')}
            </Text>
          </Pressable>

          {serverError ? <Banner tone="critical" title={serverError} /> : null}

          <Button
            label={t('auth.login.submit')}
            accessibilityLabel={t('auth.welcome.a11ySignIn')}
            onPress={onSubmit}
            disabled={busy}
            loading={login.isPending}
            icon={({ size, color }) => <ArrowRight size={size} color={color} />}
          />

          {unverifiedEmail ? (
            <Button
              label={t('auth.login.resendVerification')}
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/(auth)/check-email', params: { email: unverifiedEmail } })
              }
            />
          ) : null}
        </Stack>

        {/* The alternate path sits at the foot of the screen rather than
            directly under the form. Stacked tight beneath the primary it
            competed with it. */}
        <View style={{ flex: 1, minHeight: space.xl }} />

        <Stack gap="lg">
          {/* A labelled rule, not a third stacked button with a sentence over
              it: the label IS the separator, which is what keeps "Create
              account" reading as the other path rather than a second way to
              sign in. */}
          <Row gap="md">
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <Text variant="caption" tone="tertiary">
              {t('auth.login.noAccount')}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </Row>

          <Button
            label={t('auth.login.createAccount')}
            accessibilityLabel={t('auth.welcome.a11yCreateAccount')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
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
