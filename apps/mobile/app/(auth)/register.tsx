import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@bloodchain/validation';
import { AppButton, AppText, AppTextInput, IconButton, Screen } from '../../src/components';
import { useRegister, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { layout, spacing, useTheme } from '../../src/theme';
import { BRAND_NAME } from '../../src/brand';

export default function Register() {
  const { colors } = useTheme();
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
          Create account
        </AppText>
        <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
          Join {BRAND_NAME} and start saving lives
        </AppText>

        {/*
          First and last name stay separate fields. The reference collapses
          them into one "Full name", but `registerSchema` validates them apart,
          and splitting a typed full name back into two is guesswork on any
          name that is not exactly two words.

          Side by side, though, and without the person icon each carried: four
          full-width slabs down the screen was a longer form than this actually
          is, and a name field does not need an icon to say what it is.
        */}
        <View style={{ flexDirection: 'row', gap: layout.cardGap, marginBottom: layout.cardGap }}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <AppTextInput
                label="First name"
                placeholder="Alex"
                autoComplete="given-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => lastNameRef.current?.focus()}
                error={fieldState.error?.message}
                wrapperStyle={{ flex: 1 }}
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
              <AppTextInput
                ref={lastNameRef}
                label="Last name"
                placeholder="Johnson"
                autoComplete="family-name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                error={fieldState.error?.message}
                wrapperStyle={{ flex: 1 }}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <AppTextInput
              ref={emailRef}
              label="Email address"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              leading={<Mail size={19} color={colors.textMuted} />}
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
              placeholder="Min 12 characters"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
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
          accessibilityLabel="Create a Bloodchain account"
          style={{ height: 54 }}
          onPress={onSubmit}
          disabled={registerUser.isPending || formState.isSubmitting}
          loading={registerUser.isPending}
        >
          Create Account
        </AppButton>

      </View>

      {/* The alternate path sits at the foot of the screen, not directly under
          the form. Stacked tight beneath the primary it competed with it, and
          left the bottom of the screen empty besides. */}
      <View style={{ flex: 1, minHeight: spacing.xl }} />

      <View>
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
            Already have an account?
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Near-white on a light film, not the variant's rose on a dark tile.
            Rose text at this weight on `surfaceElevated` is the weakest
            contrast on the screen, and it read as disabled next to the CTA. */}
        <AppButton
          variant="secondary"
          textColor={colors.text}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in to Bloodchain"
          style={{
            height: 54,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        >
          Sign In
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
