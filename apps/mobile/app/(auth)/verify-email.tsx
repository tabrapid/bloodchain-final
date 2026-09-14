import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { useVerifyEmail, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { spacing, useTheme } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

export default function VerifyEmail() {
  const { t } = useTranslation();
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
            {t('auth.verifyEmail.invalidTitle')}
          </AppText>
          <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            {t('auth.verifyEmail.invalidBody')}
          </AppText>
          <AppButton onPress={() => router.replace('/(auth)/login')}>{t('auth.checkEmail.backToSignIn')}</AppButton>
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
              {t('auth.verifyEmail.verifying')}
            </AppText>
          </>
        )}

        {verifyEmail.isSuccess && (
          <>
            <CheckCircle size={64} color={colors.success} style={{ marginBottom: spacing.lg }} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              {t('auth.verifyEmail.verified')}
            </AppText>
          </>
        )}

        {error && (
          <>
            <XCircle size={64} color={colors.danger} style={{ marginBottom: spacing.lg }} />
            <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
              {t('auth.verifyEmail.failedTitle')}
            </AppText>
            <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
              {error}
            </AppText>
            <AppButton onPress={() => router.replace('/(auth)/login')}>{t('auth.checkEmail.backToSignIn')}</AppButton>
          </>
        )}
      </View>
    </Screen>
  );
}
