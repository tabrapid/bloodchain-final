import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import {
  Banner,
  Button,
  FormScreen,
  OtpField,
  ScreenHeader,
  Stack,
  Text,
  space,
} from '../../src/design';
import { requestPhoneCode, verifyPhoneCode } from '../../src/api/auth';
import { apiErrorCode, apiErrorDetails, apiErrorMessage } from '../../src/api/errors';
import { useTranslation } from '../../src/i18n';

/** Six digits, the length the API issues. */
export const OTP_LENGTH = 6;

/**
 * Step two: the code.
 *
 * The screen a donor stares at while an SMS is in flight, so it has to be
 * honest about three things at once -- whether it is working, when they may ask
 * for another code, and what went wrong if something did.
 *
 * The countdown is the part worth getting right. Without it, "Send a new code"
 * is a button that looks available and answers 429, and the donor learns
 * nothing except that the app is broken. With it, the wait is visible and the
 * button is simply not offered yet.
 *
 * V2 replaces the six-box input with the design system's `OtpField`, which
 * draws six boxes over ONE text input -- the arrangement platform autofill
 * needs. On iOS the code appears above the keyboard as "From Messages"; on
 * Android SMS Retriever fills it. Both deliver the whole code into a single
 * field, so six separate inputs silently defeat them.
 */
export default function OtpScreen() {
  const { t, locale } = useTranslation();
  const params = useLocalSearchParams<{
    phone?: string;
    purpose?: string;
    sentTo?: string;
    resendIn?: string;
  }>();

  const phone = typeof params.phone === 'string' ? params.phone : '';
  const purpose = params.purpose === 'PASSWORD_RESET' ? 'PASSWORD_RESET' : 'REGISTRATION';
  const sentTo = typeof params.sentTo === 'string' ? params.sentTo : phone;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => Number(params.resendIn ?? 60) || 0);

  // One interval for the life of the screen. Restarting it on every tick would
  // drift, and clearing it on unmount is what stops a state update landing on a
  // screen the donor has already left.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft > 0]);

  const submitted = useRef(false);

  const onSubmit = useCallback(
    async (submittedCode: string) => {
      if (submitted.current || submittedCode.length !== OTP_LENGTH) return;
      submitted.current = true;
      setError(null);
      setIsSubmitting(true);
      try {
        if (purpose === 'PASSWORD_RESET') {
          const { resetToken } = await verifyPhoneCode(phone, 'PASSWORD_RESET', submittedCode);
          // Straight into the screen the emailed link opens, carrying the same
          // kind of token: one recovery flow, reached two ways.
          router.replace({ pathname: '/(auth)/reset-password', params: { token: resetToken } });
          return;
        }

        const { verificationToken } = await verifyPhoneCode(phone, 'REGISTRATION', submittedCode);
        router.replace({
          pathname: '/(auth)/register-details',
          params: { verificationToken, phone },
        });
      } catch (err) {
        setError(apiErrorMessage(err, t));
        // A spent or dead code means starting over, so clear the field rather
        // than leaving six wrong digits for the donor to delete by hand.
        const failure = apiErrorCode(err);
        if (failure === 'AUTH_OTP_EXPIRED' || failure === 'AUTH_OTP_TOO_MANY_ATTEMPTS') {
          setCode('');
          setSecondsLeft(0);
        }
      } finally {
        setIsSubmitting(false);
        submitted.current = false;
      }
    },
    [phone, purpose, t],
  );

  const onResend = async () => {
    setError(null);
    setIsResending(true);
    try {
      const result = await requestPhoneCode(phone, purpose, locale);
      setCode('');
      setSecondsLeft(result.resendAvailableInSeconds);
    } catch (err) {
      setError(apiErrorMessage(err, t));
      // The server knows exactly how long is left; trust it over our own clock.
      const details = apiErrorDetails<{ retryAfterSeconds?: number }>(err);
      if (typeof details?.retryAfterSeconds === 'number') {
        setSecondsLeft(details.retryAfterSeconds);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      <Stack gap="xl">
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="display" accessibilityRole="header">
            {t('auth.otp.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.otp.subtitle', { phone: sentTo })}
          </Text>
        </View>

        <Stack gap="lg">
          <View style={{ gap: space.sm }}>
            <Text variant="label" tone="secondary">
              {t('auth.otp.label')}
            </Text>
            <OtpField
              length={OTP_LENGTH}
              accessibilityLabel={t('auth.otp.a11yField')}
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
              onComplete={onSubmit}
              disabled={isSubmitting}
            />
          </View>

          {error ? <Banner tone="critical" title={error} /> : null}

          <Button
            label={t('auth.otp.submit')}
            accessibilityLabel={t('auth.otp.a11ySubmit')}
            onPress={() => onSubmit(code)}
            disabled={code.length !== OTP_LENGTH || isSubmitting}
            loading={isSubmitting}
            icon={({ size, color }) => <ArrowRight size={size} color={color} />}
          />
        </Stack>

        <Stack gap="md" style={{ alignItems: 'center' }}>
          {secondsLeft > 0 ? (
            // Not a disabled button: a control that looks pressable and does
            // nothing is worse than a sentence that explains the wait.
            <Text variant="caption" tone="tertiary" accessibilityRole="text">
              {t('auth.otp.resendIn', { seconds: secondsLeft })}
            </Text>
          ) : (
            <Pressable
              onPress={onResend}
              disabled={isResending}
              accessibilityRole="button"
              accessibilityLabel={t('auth.otp.a11yResend')}
              accessibilityState={{ disabled: isResending, busy: isResending }}
              hitSlop={12}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="bodyStrong" tone="clinical">
                {isResending ? t('common.sending') : t('auth.otp.resend')}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel={t('auth.otp.wrongNumber')}
            hitSlop={12}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="caption" tone="tertiary">
              {t('auth.otp.wrongNumber')}
            </Text>
          </Pressable>
        </Stack>
      </Stack>
    </FormScreen>
  );
}
