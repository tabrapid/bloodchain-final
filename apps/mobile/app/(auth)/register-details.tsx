import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema, nameSchema, strongPasswordSchema } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, Screen } from '../../src/components';
import { registerWithPhone } from '../../src/api/auth';
import { apiErrorMessage } from '../../src/api/errors';
import { useAuthStore } from '../../src/stores/auth.store';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { spacing, useTheme } from '../../src/theme';
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
  const { colors } = useTheme();
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ marginTop: spacing.xl }}>
          <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            {t('auth.details.title')}
          </AppText>
          <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
            {t('auth.details.subtitle')}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <AppTextInput
                label={t('auth.register.firstName')}
                placeholder={t('auth.register.firstNamePlaceholder')}
                leading={<User size={18} color={colors.textMuted} />}
                autoComplete="given-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => lastNameRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ flex: 1 }}
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
              <AppTextInput
                ref={lastNameRef}
                label={t('auth.register.lastName')}
                placeholder={t('auth.register.lastNamePlaceholder')}
                autoComplete="family-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                wrapperStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!isSubmitting}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AppTextInput
              ref={passwordRef}
              label={t('auth.fields.password')}
              placeholder={t('auth.fields.passwordPlaceholder')}
              leading={<Lock size={18} color={colors.textMuted} />}
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
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
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

        <AppText muted style={{ fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('auth.fields.passwordPolicy')}
        </AppText>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <AppTextInput
              label={t('auth.details.emailLabel')}
              placeholder={t('auth.fields.emailPlaceholder')}
              leading={<Mail size={18} color={colors.textMuted} />}
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

        <AppText muted style={{ fontSize: 12, marginTop: spacing.xs }}>
          {t('auth.details.emailHint')}
        </AppText>

        {serverError && (
          <AppText
            accessibilityRole="alert"
            style={{ fontSize: 13, color: colors.danger, marginTop: spacing.md }}
          >
            {serverError}
          </AppText>
        )}

        <AppButton
          gradient
          trailingIcon={ArrowRight}
          onPress={onSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth.details.a11ySubmit')}
          style={{ marginTop: spacing.xl }}
        >
          {t('auth.details.submit')}
        </AppButton>
      </KeyboardAvoidingView>
    </Screen>
  );
}
