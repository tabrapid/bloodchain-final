import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
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
      <View style={{ marginTop: spacing['2xl'] }}>
        {/* The auth headlines are the one place the reference goes bigger and
            heavier than the standard screen title. */}
        <AppText variant="title" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.96 }}>
          Welcome back.
        </AppText>
        <AppText muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Sign in to your private health space.
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

        <AppButton onPress={onSubmit} disabled={login.isPending || formState.isSubmitting}>
          {login.isPending ? 'Signing in...' : 'Sign in'}
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

        <AppButton
          variant="ghost"
          style={{ marginTop: spacing.md }}
          onPress={() => router.push('/(auth)/register')}
        >
          Don't have an account? Create one
        </AppButton>
      </View>
    </Screen>
  );
}
