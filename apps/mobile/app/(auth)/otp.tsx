import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { AppButton, AppText, IconButton, OTP_LENGTH, OtpInput, Screen } from '../../src/components';
import { requestPhoneCode, verifyPhoneCode } from '../../src/api/auth';
import { apiErrorCode, apiErrorDetails, apiErrorMessage } from '../../src/api/errors';
import { spacing, useTheme } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

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
 */
export default function OtpScreen() {
  const { colors } = useTheme();
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
        const code = apiErrorCode(err);
        if (code === 'AUTH_OTP_EXPIRED' || code === 'AUTH_OTP_TOO_MANY_ATTEMPTS') {
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <IconButton
          icon={ChevronLeft}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('auth.a11y.goBack')}
        />

        <View style={{ marginTop: spacing.xl }}>
          <AppText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            {t('auth.otp.title')}
          </AppText>
          <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
            {t('auth.otp.subtitle', { phone: sentTo })}
          </AppText>
        </View>

        <OtpInput
          label={t('auth.otp.label')}
          accessibilityLabel={t('auth.otp.a11yField')}
          value={code}
          onChangeCode={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          onComplete={onSubmit}
          editable={!isSubmitting}
        />

        {error && (
          <AppText
            accessibilityRole="alert"
            style={{ fontSize: 13, color: colors.danger, marginTop: spacing.md }}
          >
            {error}
          </AppText>
        )}

        <AppButton
          gradient
          trailingIcon={ArrowRight}
          onPress={() => onSubmit(code)}
          disabled={code.length !== OTP_LENGTH || isSubmitting}
          loading={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth.otp.a11ySubmit')}
          style={{ marginTop: spacing.xl }}
        >
          {t('auth.otp.submit')}
        </AppButton>

        <View style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          {secondsLeft > 0 ? (
            // Not a disabled button: a control that looks pressable and does
            // nothing is worse than a sentence that explains the wait.
            <AppText muted style={{ fontSize: 13 }} accessibilityRole="text">
              {t('auth.otp.resendIn', { seconds: secondsLeft })}
            </AppText>
          ) : (
            <Pressable
              onPress={onResend}
              disabled={isResending}
              accessibilityRole="button"
              accessibilityLabel={t('auth.otp.a11yResend')}
              hitSlop={8}
            >
              <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                {isResending ? t('common.sending') : t('auth.otp.resend')}
              </AppText>
            </Pressable>
          )}

          <Pressable onPress={() => router.back()} accessibilityRole="link" hitSlop={8}>
            <AppText muted style={{ fontSize: 13 }}>
              {t('auth.otp.wrongNumber')}
            </AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
