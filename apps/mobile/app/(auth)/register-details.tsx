import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema, nameSchema, strongPasswordSchema } from '@bloodchain/validation';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  Row,
  Stack,
  Text,
  iconSize,
  space,
  useDesign,
  ScreenHeader,
} from '../../src/design';
import { registerWithPhone } from '../../src/api/auth';
import { apiErrorMessage } from '../../src/api/errors';
import { useAuthStore } from '../../src/stores/auth.store';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { useTranslation } from '../../src/i18n';

/**
 * Step three: who they are, and a password.
 *
 * Messages are catalogue keys, resolved at render -- the schema is built at
 * module load, where there is no locale.
 *
 * Email is optional and says so. Requiring an address most of this market does
 * not use was the barrier this whole sprint exists to remove; offering it is
 * still worth doing, because it is how someone recovers the account from a
 * laptop.
 */
const formSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  password: strongPasswordSchema,
  email: z.union([z.literal(''), emailSchema]),
});

type FormValues = z.input<typeof formSchema>;

export default function RegisterDetails() {
  const { colors } = useDesign();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ verificationToken?: string; phone?: string }>();
  const setUser = useAuthStore((s) => s.setUser);

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastNameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', password: '', email: '' },
  });

  const verificationToken =
    typeof params.verificationToken === 'string' ? params.verificationToken : '';

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await registerWithPhone({
        verificationToken,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
        email: values.email ? values.email : undefined,
      });
      setUser({
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        displayName: result.user.displayName,
        avatarUrl: undefined,
        status: result.user.status,
        emailVerified: false,
        phoneVerified: true,
        lastLoginAt: undefined,
        roles: result.user.roles,
        organizations: [],
        donorProfile: null,
        permissions: result.user.permissions,
      });
      router.replace(getPostAuthRoute(result.user.roles));
    } catch (err) {
      setServerError(apiErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    // The only step of sign-up with no header at all: no back, no exit. It is
    // reached by `router.replace` from the OTP screen, so a donor who mistyped
    // their name had nothing to press. The header takes the place of the extra
    // top margin the title block was carrying instead.
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      <Stack gap="xl">
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="display" accessibilityRole="header">
            {t('auth.details.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.details.subtitle')}
          </Text>
        </View>

        <Stack gap="lg">
        <Row gap="md" align="flex-start">
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <Field
                label={t('auth.register.firstName')}
                placeholder={t('auth.register.firstNamePlaceholder')}
                leading={<User size={iconSize.md} color={colors.textTertiary} />}
                autoComplete="given-name"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                containerStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!isSubmitting}
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
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                containerStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!isSubmitting}
              />
            )}
          />
        </Row>

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              ref={passwordRef}
              label={t('auth.fields.password')}
              hint={t('auth.fields.passwordPolicy')}
              placeholder={t('auth.fields.passwordPlaceholder')}
              leading={<Lock size={iconSize.md} color={colors.textTertiary} />}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="next"
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              trailing={
                <Pressable
                  onPress={() => setShowPassword((shown) => !shown)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')
                  }
                  hitSlop={12}
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
              editable={!isSubmitting}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label={t('auth.details.emailLabel')}
              hint={t('auth.details.emailHint')}
              placeholder={t('auth.fields.emailPlaceholder')}
              leading={<Mail size={iconSize.md} color={colors.textTertiary} />}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={() => onSubmit()}
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!isSubmitting}
            />
          )}
        />

        {serverError ? <Banner tone="critical" title={serverError} /> : null}

        <Button
          label={t('auth.details.submit')}
          accessibilityLabel={t('auth.details.a11ySubmit')}
          onPress={onSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          icon={({ size, color }) => <ArrowRight size={size} color={color} />}
        />
        </Stack>
      </Stack>
    </FormScreen>
  );
}
