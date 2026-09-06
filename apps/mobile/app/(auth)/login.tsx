import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, IconButton, Screen } from '../../src/components';
import { useLogin, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { layout, spacing, useTheme } from '../../src/theme';
import { BRAND_NAME } from '../../src/brand';

export default function Login() {
  const { colors } = useTheme();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
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
      <IconButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      />

      <View style={{ marginTop: spacing.xl }}>
        {/* The auth headlines are the one place the reference goes bigger and
            heavier than the standard screen title. */}
        <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
          Welcome back
        </AppText>
        <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
          Sign in to your {BRAND_NAME} account
        </AppText>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <AppTextInput
              label="Email address"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              leading={<Mail size={19} color={colors.textMuted} />}
              // The return key walks the form instead of dismissing the
              // keyboard, which on a two-field form is the whole interaction.
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={fieldState.error?.message}
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
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              leading={<Lock size={19} color={colors.textMuted} />}
              error={fieldState.error?.message}
              wrapperStyle={{ marginBottom: spacing.lg }}
              trailing={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
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

        {serverError && (
          <AppText style={{ color: colors.danger, marginBottom: spacing.md }}>
            {serverError}
          </AppText>
        )}

        <AppButton
          gradient
          trailingIcon={ArrowRight}
          accessibilityRole="button"
          accessibilityLabel="Sign in to Bloodchain"
          style={{ height: 54 }}
          onPress={onSubmit}
          disabled={login.isPending || formState.isSubmitting}
          loading={login.isPending}
        >
          Sign In
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

      {/* The alternate path sits at the foot of the screen, not directly under
          the form. Stacked tight beneath the primary it competed with it, and
          left the bottom third of the screen empty besides. */}
      <View style={{ flex: 1, minHeight: spacing.xl }} />

      <View>
        {/* A labelled rule, not a third stacked button with a sentence over it:
            the label *is* the separator, which is what keeps "Create Account"
            reading as the other path rather than a second way to sign in. */}
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
            Don&apos;t have an account?
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Near-white on a light film, not the variant's rose on a dark tile.
            Rose text at this weight on `surfaceElevated` is the weakest
            contrast on the screen, and it read as disabled next to the CTA. */}
        <AppButton
          variant="secondary"
          textColor={colors.text}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel="Create a Bloodchain account"
          style={{
            height: 54,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        >
          Create Account
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
            Your data is private and secure.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
