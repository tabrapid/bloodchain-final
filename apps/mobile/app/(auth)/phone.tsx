import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { ArrowRight, ChevronLeft, Mail } from 'lucide-react-native';
import { normalizePhone } from '@bloodchain/validation';
import { AppButton, AppText, IconButton, PhoneInput, Screen } from '../../src/components';
import { requestPhoneCode } from '../../src/api/auth';
import { apiErrorMessage } from '../../src/api/errors';
import { spacing, useTheme } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/**
 * Step one of phone-first sign-up: the number.
 *
 * This is the first screen a new donor sees, and it asks for one thing. The
 * name, the password and the optional email all come *after* the number is
 * confirmed, because a form abandoned at field six has cost the donor six
 * fields and told us nothing, while a number abandoned at the code screen has
 * at least told us the number was real.
 *
 * Reached for recovery too, with `?purpose=PASSWORD_RESET`: the same number,
 * the same code, and the API decides what the code is good for.
 */
export default function PhoneEntry() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const params = useLocalSearchParams<{ purpose?: string }>();
  const purpose = params.purpose === 'PASSWORD_RESET' ? 'PASSWORD_RESET' : 'REGISTRATION';

  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phone = normalizePhone(`+998${digits}`);
  const canSubmit = phone !== null && !isSubmitting;

  const onSubmit = async () => {
    if (!phone) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await requestPhoneCode(phone, purpose, locale);
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone,
          purpose,
          sentTo: result.sentTo,
          resendIn: String(result.resendAvailableInSeconds),
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
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
          {t('auth.phone.title')}
        </AppText>
        <AppText muted style={{ fontSize: 15, marginTop: 6, marginBottom: spacing.xl }}>
          {t('auth.phone.subtitle')}
        </AppText>
      </View>

      <PhoneInput
        label={t('auth.phone.label')}
        placeholder={t('auth.phone.placeholder')}
        accessibilityLabel={t('auth.phone.a11yField')}
        value={digits}
        onChangeDigits={(next) => {
          setDigits(next);
          if (error) setError(null);
        }}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && onSubmit()}
        editable={!isSubmitting}
      />

      <AppText muted style={{ fontSize: 12, marginTop: spacing.xs }}>
        {t('auth.phone.hint')}
      </AppText>

      {error && (
        <AppText
          accessibilityRole="alert"
          style={{ fontSize: 13, color: colors.danger, marginTop: spacing.md }}
        >
          {error}
        </AppText>
      )}

      <AppButton
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={isSubmitting}
        gradient
        trailingIcon={ArrowRight}
        accessibilityLabel={t('auth.phone.a11ySubmit')}
        style={{ marginTop: spacing.xl }}
      >
        {t('auth.phone.submit')}
      </AppButton>

      {purpose === 'REGISTRATION' && (
        <View style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="link"
            hitSlop={8}
          >
            <AppText muted style={{ fontSize: 14 }}>
              {t('auth.phone.signInInstead')}{' '}
              <AppText style={{ color: colors.primary, fontWeight: '600' }}>
                {t('auth.phone.signIn')}
              </AppText>
            </AppText>
          </Pressable>

          {/* Email sign-up stays reachable. Every account made before this
              sprint has one, and some donors would rather use it. */}
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="link"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            <Mail size={14} color={colors.textMuted} />
            <AppText muted style={{ fontSize: 13 }}>
              {t('auth.phone.useEmail')}
            </AppText>
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
