import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, Screen } from '../../src/components';
import { useLogin, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { spacing, useTheme } from '../../src/theme';

export default function Login() {
  const { colors } = useTheme();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    setUnverifiedEmail(null);
    try {
      const result = await login.mutateAsync(data);
      router.replace(getPostAuthRoute(result.user.roles));
    } catch (err: unknown) {
      const message = getAuthErrorMessage(err);
      setServerError(message);
      if (message.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(data.email);
      }
    }
  });

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
          alignSelf: 'flex-start',
          paddingRight: spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
        <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Back</AppText>
      </Pressable>

      <View style={{ marginTop: spacing.xl }}>
        {/* The auth headlines are the one place the reference goes bigger and
            heavier than the standard screen title. */}
        <AppText variant="title" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.96 }}>
          Welcome back.
        </AppText>
        <AppText muted style={{ fontSize: 14, marginTop: 6, marginBottom: spacing.xl }}>
          Sign in to continue saving lives.
        </AppText>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <AppTextInput
              label="Email address"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              error={fieldState.error?.message}
              wrapperStyle={{ marginBottom: spacing.md }}
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
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              error={fieldState.error?.message}
              wrapperStyle={{ marginBottom: spacing.lg }}
              trailing={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
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

        {serverError && (
          <AppText style={{ color: colors.danger, marginBottom: spacing.md }}>
            {serverError}
          </AppText>
        )}

        <AppButton
          onPress={onSubmit}
          disabled={login.isPending || formState.isSubmitting}
          loading={login.isPending}
        >
          Sign in
        </AppButton>

        {unverifiedEmail && (
          <AppButton
            variant="ghost"
            style={{ marginTop: spacing.md }}
            onPress={() =>
              router.push({ pathname: '/(auth)/check-email', params: { email: unverifiedEmail } })
            }
          >
            Resend verification email
          </AppButton>
        )}

        {/* The reference closes the form with a sentence, not a third
            button -- a ghost button here reads as an equal alternative to
            signing in, which it is not. */}
        <AppText style={{ textAlign: 'center', fontSize: 13, color: colors.textMuted, marginTop: spacing.lg }}>
          Don&apos;t have an account?{' '}
          <AppText
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="link"
            style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}
          >
            Create one
          </AppText>
        </AppText>
      </View>
    </Screen>
  );
}
