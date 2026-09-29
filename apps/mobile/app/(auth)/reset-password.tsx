import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { CheckCircle2, KeyRound, Lock, LinkIcon } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { strongPasswordSchema } from '@bloodchain/validation';
import {
  Banner,
  Button,
  Field,
  FormScreen,
  LinkButton,
  PasswordField,
  Screen,
  ScreenHeader,
  Stack,
  Text,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../src/design';
import {
  useResetPassword,
  getRecoveryErrorMessage,
  isRejectedResetToken,
} from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/i18n';

/**
 * The form, which is not the request body.
 *
 * `resetPasswordSchema` in @bloodchain/validation mirrors the server's DTO and
 * is the contract; the confirmation field exists only to catch a typo before it
 * becomes a password nobody knows, so it is validated here.
 */
/**
 * Messages are catalogue keys, resolved at render by `t`.
 *
 * The schema is built once at module load, where there is no locale, so it
 * cannot hold translated text. A key that no catalogue has -- the password
 * policy messages, which come from @bloodchain/validation in English -- passes
 * through `t` unchanged, so nothing is lost while those are still untranslated.
 */
const formSchema = z
  .object({
    token: z.string().trim().min(1, 'auth.errors.codeRequired').max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'auth.errors.confirmRequired'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'auth.errors.passwordsDoNotMatch',
  });

type FormValues = z.infer<typeof formSchema>;

/**
 * Step two of account recovery: spend the link and set a new password.
 *
 * Reached two ways. From the email's deep link
 * (`donor://reset-password?token=…`) the token arrives as a route param and the
 * code field stays hidden -- the user has already proved they read the mail.
 * Opened directly, the field is shown so a code can be pasted, which is what
 * happens when the mail was opened on a laptop and the phone is where the app
 * lives.
 */
export default function ResetPassword() {
  const { colors } = useDesign();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = typeof params.token === 'string' ? params.token : '';
  const reset = useResetPassword();

  const [serverError, setServerError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { token: linkToken, newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setTokenRejected(false);
    try {
      await reset.mutateAsync({ token: values.token.trim(), newPassword: values.newPassword });
      setDone(true);
    } catch (err: unknown) {
      // A refused token is not a form error -- there is nothing to correct on
      // this screen, so the whole screen changes rather than showing a red line
      // under a field the user cannot fix.
      if (isRejectedResetToken(err)) {
        setTokenRejected(true);
        return;
      }
      setServerError(getRecoveryErrorMessage(err));
    }
  });

  const busy = reset.isPending || formState.isSubmitting;

  if (done) {
    return (
      <Outcome
        tone="success"
        icon={<CheckCircle2 size={iconSize.xl} color={colors.success.base} strokeWidth={1.5} />}
        title={t('auth.resetPassword.doneTitle')}
        // Said plainly, because it is a consequence the donor will otherwise
        // meet as an unexplained sign-out on their other device.
        body={t('auth.resetPassword.doneBody')}
        primary={{
          label: t('auth.resetPassword.goToSignIn'),
          accessibilityLabel: t('auth.resetPassword.a11yGoToSignIn'),
          onPress: () => router.replace('/(auth)/login'),
        }}
      />
    );
  }

  if (tokenRejected) {
    return (
      <Outcome
        tone="critical"
        icon={<LinkIcon size={iconSize.xl} color={colors.critical.base} strokeWidth={1.5} />}
        title={t('auth.resetPassword.rejectedTitle')}
        // The server will not say which of the three it is, and guessing would
        // be worse than saying so: all three have the same remedy.
        body={t('auth.resetPassword.rejectedBody')}
        primary={{
          label: t('auth.resetPassword.requestNewLink'),
          accessibilityLabel: t('auth.resetPassword.a11yRequestNewLink'),
          onPress: () => router.replace('/(auth)/forgot-password'),
        }}
        secondary={{
          label: t('auth.checkEmail.backToSignIn'),
          onPress: () => router.replace('/(auth)/login'),
        }}
      />
    );
  }

  return (
    <FormScreen header={<ScreenHeader onBack={() => router.back()} backLabel={t('auth.a11y.goBack')} />}>
      {/*
        The spacer below can only push the alternate path to the foot of the
        screen if something above it is allowed to grow. Without this flex, the
        Stack sized itself to its content and the spacer collapsed to its 24pt
        minimum -- so "Create account" sat directly under the form with the rest
        of the page empty beneath it.
      */}
      <Stack gap="xl" style={{ flex: 1 }}>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text variant="h1" accessibilityRole="header">
            {t('auth.resetPassword.title')}
          </Text>
          <Text variant="body" tone="secondary">
            {linkToken ? t('auth.resetPassword.subtitleFromLink') : t('auth.resetPassword.subtitleManual')}
          </Text>
        </View>

        <Stack gap="lg">
          {/* Hidden when the deep link supplied it: showing a 64-character
              string the donor cannot meaningfully check is noise, and an
              editable field invites breaking a token that already works. */}
          {!linkToken ? (
            <Controller
              control={control}
              name="token"
              render={({ field, fieldState }) => (
                <Field
                  label={t('auth.resetPassword.code')}
                  placeholder={t('auth.resetPassword.codePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  leading={<KeyRound size={iconSize.md} color={colors.textTertiary} />}
                  returnKeyType="next"
                  editable={!busy}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="newPassword"
            render={({ field, fieldState }) => (
              <PasswordField
                label={t('auth.resetPassword.newPassword')}
                placeholder={t('auth.fields.passwordPlaceholder')}
                // The policy in advance, rather than as four separate
                // rejections.
                hint={t('auth.fields.passwordPolicy')}
                autoComplete="new-password"
                autoFocus={Boolean(linkToken)}
                leading={<Lock size={iconSize.md} color={colors.textTertiary} />}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!busy}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                showLabel={t('auth.fields.showPassword')}
                hideLabel={t('auth.fields.hidePassword')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <PasswordField
                ref={confirmRef}
                label={t('auth.resetPassword.confirmPassword')}
                placeholder={t('auth.resetPassword.confirmPlaceholder')}
                autoComplete="new-password"
                leading={<Lock size={iconSize.md} color={colors.textTertiary} />}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!busy}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                showLabel={t('auth.fields.showPassword')}
                hideLabel={t('auth.fields.hidePassword')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {serverError ? <Banner tone="critical" title={serverError} /> : null}

          <Button
            label={t('auth.resetPassword.submit')}
            accessibilityLabel={t('auth.resetPassword.a11ySubmit')}
            onPress={onSubmit}
            disabled={busy}
            loading={reset.isPending}
          />
        </Stack>

        <View style={{ flex: 1, minHeight: space.xl }} />

        <LinkButton
          label={t('auth.checkEmail.backToSignIn')}
          tone="secondary"
          onPress={() => router.replace('/(auth)/login')}
        />
      </Stack>
    </FormScreen>
  );
}

/**
 * The two dead ends this screen can reach: the password was changed, or the
 * token was refused. Neither has a form on it, both need the same shape, and
 * writing that shape twice is how the two drift apart.
 */
function Outcome({
  tone,
  icon,
  title,
  body,
  primary,
  secondary,
}: {
  tone: 'success' | 'critical';
  icon: React.ReactNode;
  title: string;
  body: string;
  primary: { label: string; accessibilityLabel: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
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
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors[tone].soft,
            }}
          >
            {icon}
          </View>

          <Stack gap="sm" style={{ alignItems: 'center' }}>
            <Text variant="h1" align="center" accessibilityRole="alert">
              {title}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {body}
            </Text>
          </Stack>

          <Stack gap="md" style={{ alignSelf: 'stretch' }}>
            <Button
              label={primary.label}
              accessibilityLabel={primary.accessibilityLabel}
              onPress={primary.onPress}
            />
            {secondary ? (
              <LinkButton label={secondary.label} onPress={secondary.onPress} />
            ) : null}
          </Stack>
        </Stack>
      </View>
    </Screen>
  );
}
