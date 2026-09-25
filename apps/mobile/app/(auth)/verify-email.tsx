import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CheckCircle, XCircle } from 'lucide-react-native';
import {
  Button,
  LoadingSection,
  Screen,
  Stack,
  Text,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../src/design';
import { useVerifyEmail, getAuthErrorMessage } from '../../src/hooks/useAuth';
import { getPostAuthRoute } from '../../src/utils/postAuthRoute';
import { useTranslation } from '../../src/i18n';

/**
 * Where the emailed confirmation link lands.
 *
 * Three states and nothing else: working, done, failed. The donor arrives here
 * from their mail app with no context, so each state says what happened and
 * what to do next -- a failure with no way back to sign-in is a dead end
 * reached from outside the app.
 */
export default function VerifyEmail() {
  const { t } = useTranslation();
  const { colors } = useDesign();
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
      <Outcome
        tone="critical"
        icon={<XCircle size={iconSize.xl} color={colors.critical.base} />}
        title={t('auth.verifyEmail.invalidTitle')}
        body={t('auth.verifyEmail.invalidBody')}
        actionLabel={t('auth.checkEmail.backToSignIn')}
      />
    );
  }

  if (error) {
    return (
      <Outcome
        tone="critical"
        icon={<XCircle size={iconSize.xl} color={colors.critical.base} />}
        title={t('auth.verifyEmail.failedTitle')}
        body={error}
        actionLabel={t('auth.checkEmail.backToSignIn')}
      />
    );
  }

  if (verifyEmail.isSuccess) {
    return (
      <Outcome
        tone="success"
        icon={<CheckCircle size={iconSize.xl} color={colors.success.base} />}
        title={t('auth.verifyEmail.verified')}
      />
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSection label={t('auth.verifyEmail.verifying')} />
      </View>
    </Screen>
  );
}

function Outcome({
  tone,
  icon,
  title,
  body,
  actionLabel,
}: {
  tone: 'success' | 'critical';
  icon: React.ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
}) {
  const { colors } = useDesign();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Stack gap="xl" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors[tone].soft,
            }}
          >
            {icon}
          </View>

          <Stack gap="sm" style={{ alignItems: 'center' }}>
            {/* `alert`, not `header`: the donor did not navigate here, the
                link did, and the outcome is the thing that needs announcing. */}
            <Text variant="h1" align="center" accessibilityRole="alert">
              {title}
            </Text>
            {body ? (
              <Text variant="body" tone="secondary" align="center">
                {body}
              </Text>
            ) : null}
          </Stack>

          {actionLabel ? (
            <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>
              <Button label={actionLabel} onPress={() => router.replace('/(auth)/login')} />
            </View>
          ) : null}
        </Stack>
      </View>
    </Screen>
  );
}
