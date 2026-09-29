import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, Mail } from 'lucide-react-native';
import { normalizePhone } from '@bloodchain/validation';
import {
  Banner,
  Button,
  FormScreen,
  LinkButton,
  PhoneField,
  Row,
  ScreenHeader,
  Stack,
  Text,
  space,
} from '../../src/design';
import { requestPhoneCode } from '../../src/api/auth';
import { apiErrorMessage } from '../../src/api/errors';
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
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      <Stack gap="xl">
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text variant="h1" accessibilityRole="header">
            {t('auth.phone.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.phone.subtitle')}
          </Text>
        </View>

        <Stack gap="lg">
          <PhoneField
            prefix="+998"
            label={t('auth.phone.label')}
            placeholder={t('auth.phone.placeholder')}
            accessibilityLabel={t('auth.phone.a11yField')}
            hint={t('auth.phone.hint')}
            value={digits}
            onChangeText={(next) => {
              setDigits(next.replace(/\D/g, '').slice(0, 9));
              if (error) setError(null);
            }}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && onSubmit()}
            editable={!isSubmitting}
          />

          {error ? <Banner tone="critical" title={error} /> : null}

          <Button
            label={t('auth.phone.submit')}
            accessibilityLabel={t('auth.phone.a11ySubmit')}
            onPress={onSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            icon={({ size, color }) => <ArrowRight size={size} color={color} />}
          />
        </Stack>

        {purpose === 'REGISTRATION' ? (
          <Stack gap="sm" style={{ alignItems: 'center' }}>
            <Row gap="xs">
              <Text variant="body" tone="secondary">
                {t('auth.phone.signInInstead')}
              </Text>
              <LinkButton
                label={t('auth.phone.signIn')}
                accessibilityLabel={t('auth.welcome.a11ySignIn')}
                onPress={() => router.push('/(auth)/login')}
              />
            </Row>

            {/* Email sign-up stays reachable. Every account made before this
                sprint has one, and some donors would rather use it. */}
            <LinkButton
              label={t('auth.phone.useEmail')}
              tone="secondary"
              icon={({ size, color }) => <Mail size={size} color={color} />}
              onPress={() => router.push('/(auth)/register')}
            />
          </Stack>
        ) : null}
      </Stack>
    </FormScreen>
  );
}
