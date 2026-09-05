import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, Screen } from '../../src/components';
import { useRegister, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { spacing, useTheme } from '../../src/theme';

export default function Register() {
  const { colors } = useTheme();
  const registerUser = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

      <View style={{ marginTop: spacing.lg }}>
        {/* The auth headlines are the one place the reference goes bigger and
            heavier than the standard screen title. */}
        <AppText variant="title" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.96 }}>
          Join Donor.
        </AppText>
        <AppText muted style={{ fontSize: 14, marginTop: 6, marginBottom: spacing.xl }}>
          Create your account and start saving lives.
        </AppText>

        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <AppTextInput
              label="First name"
              placeholder="Alex"
              error={fieldState.error?.message}
              wrapperStyle={{ marginBottom: spacing.md }}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <AppTextInput
              label="Last name"
              placeholder="Johnson"
              error={fieldState.error?.message}
              wrapperStyle={{ marginBottom: spacing.md }}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

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
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AppTextInput
              label="Password"
              placeholder="Min 12 characters"
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
          disabled={registerUser.isPending || formState.isSubmitting}
          loading={registerUser.isPending}
        >
          Create account
        </AppButton>

        {/* The reference closes the form with a sentence, not a second
            button competing with the primary action. */}
        <AppText style={{ textAlign: 'center', fontSize: 13, color: colors.textMuted, marginTop: spacing.lg }}>
          Already have an account?{' '}
          <AppText
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="link"
            style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}
          >
            Sign in
          </AppText>
        </AppText>
      </View>
    </Screen>
  );
}
