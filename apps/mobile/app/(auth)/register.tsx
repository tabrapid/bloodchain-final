import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@bloodchain/validation';
import { AppButton, AppText, Screen } from '../../src/components';
import { useRegister, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { colors, spacing } from '../../src/theme';

export default function Register() {
  const registerUser = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
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
      <View style={{ marginTop: spacing.xl }}>
        <AppText variant="title">Create your account.</AppText>
        <AppText muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Your health data stays private and secure.
        </AppText>

        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <TextInput
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              style={[inputStyle, fieldState.error && { borderColor: colors.danger }]}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <TextInput
              placeholder="Last name"
              placeholderTextColor={colors.textMuted}
              style={[inputStyle, fieldState.error && { borderColor: colors.danger }]}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

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
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextInput
              placeholder="Password (min 12 characters)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={[
                inputStyle,
                { marginBottom: spacing.lg },
                fieldState.error && { borderColor: colors.danger },
              ]}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        {serverError && (
          <AppText style={{ color: colors.danger, marginBottom: spacing.md }}>
            {serverError}
          </AppText>
        )}

        <AppButton onPress={onSubmit} disabled={registerUser.isPending || formState.isSubmitting}>
          {registerUser.isPending ? 'Creating account...' : 'Create account'}
        </AppButton>

        <AppButton
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
          style={{ marginTop: spacing.md }}
        >
          Already have an account? Sign in
        </AppButton>
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
