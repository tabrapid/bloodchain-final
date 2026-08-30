import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { useVerifyEmail, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { spacing, useTheme } from '../../src/theme';

export default function VerifyEmail() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const verifyEmail = useVerifyEmail();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !params.token) return;
    attempted.current = true;

    verifyEmail.mutate(params.token, {
      onSuccess: (data) => {
        router.replace(getPostAuthRoute(data.user.roles));
      },
      onError: (err: unknown) => {
        setError(getAuthErrorMessage(err));
      },
    });
  }, [params.token, verifyEmail]);

  if (!params.token) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <XCircle size={64} color={colors.danger} style={{ marginBottom: spacing.lg }} />
          <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
            Invalid link
          </AppText>
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            This verification link is missing its token.
          </AppText>
          <AppButton onPress={() => router.replace('/(auth)/login')}>Back to sign in</AppButton>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        {verifyEmail.isPending && (
          <>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.lg }} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Verifying your email...
            </AppText>
          </>
        )}

        {verifyEmail.isSuccess && (
          <>
            <CheckCircle size={64} color={colors.success} style={{ marginBottom: spacing.lg }} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Email verified
            </AppText>
          </>
        )}

        {error && (
          <>
            <XCircle size={64} color={colors.danger} style={{ marginBottom: spacing.lg }} />
            <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
              Verification failed
            </AppText>
            <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
              {error}
            </AppText>
            <AppButton onPress={() => router.replace('/(auth)/login')}>Back to sign in</AppButton>
          </>
        )}
      </View>
    </Screen>
  );
}
