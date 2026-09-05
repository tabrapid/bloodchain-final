import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { useResendVerification, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { spacing, useTheme } from '../../src/theme';

export default function CheckEmail() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const resend = useResendVerification();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onResend = async () => {
    if (!params.email) return;
    setError(null);
    setSent(false);
    try {
      await resend.mutateAsync(params.email);
      setSent(true);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: colors.secondaryMuted,
            borderWidth: 1,
            borderColor: `${colors.onMuted.secondary}4D`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <Mail size={36} color={colors.onMuted.secondary} strokeWidth={1.5} />
        </View>

        <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
          Check your email
        </AppText>

        <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          {params.email
            ? `We sent a verification link to ${params.email}. Open it on this device to activate your account.`
            : 'We sent you a verification link. Open it on this device to activate your account.'}
        </AppText>

        {sent && (
          <AppText style={{ color: colors.success, marginBottom: spacing.md, textAlign: 'center' }}>
            A new verification email is on its way.
          </AppText>
        )}

        {error && (
          <AppText style={{ color: colors.danger, marginBottom: spacing.md, textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        {/* The reference leads with one full-width action and puts the
            secondary path under it as a plain link. */}
        <AppButton
          onPress={() => router.replace('/(auth)/login')}
          style={{ alignSelf: 'stretch' }}
        >
          Back to sign in
        </AppButton>

        <Pressable
          onPress={onResend}
          disabled={resend.isPending || !params.email}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: 20,
            minHeight: 44,
            justifyContent: 'center',
            opacity: pressed || resend.isPending || !params.email ? 0.6 : 1,
          })}
        >
          <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
            {resend.isPending ? 'Sending…' : 'Resend email'}
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
