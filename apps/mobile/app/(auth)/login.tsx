import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@bloodchain/validation';
import { AppButton, AppText, Screen } from '../../src/components';
import { useLogin, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { useAuthStore } from '../../src/stores/auth.store';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { colors, spacing } from '../../src/theme';

export default function Login() {
  const login = useLogin();
  const setLoading = useAuthStore((s) => s.setLoading);
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    setUnverifiedEmail(null);
    setLoading(true);
    try {
      const result = await login.mutateAsync(data);
      router.replace(getPostAuthRoute(result.user.roles));
    } catch (err: unknown) {
      const message = getAuthErrorMessage(err);
      setServerError(message);
      if (message.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(data.email);
      }
      setLoading(false);
    }
  });

  return (
    <Screen>
      <View style={{ marginTop: spacing['2xl'] }}>
        <AppText variant="title">Welcome back.</AppText>
        <AppText muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Sign in to your private health space.
        </AppText>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[inputStyle, fieldState.error && { borderColor: colors.danger }]}
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
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={[
                inputStyle,
                { marginBottom: spacing.lg },
                fieldState.error && { borderColor: colors.danger },
              ]}
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
      </View>
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 10,
  padding: 16,
  color: colors.text,
  marginBottom: 12,
};
