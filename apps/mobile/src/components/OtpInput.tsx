import { ForwardedRef, forwardRef } from 'react';
import { TextInput } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { AppTextInput, type AppTextInputProps } from './AppTextInput';
import { useTheme } from '../theme';

/** Six digits: what fits on a lock-screen notification and can be retyped. */
export const OTP_LENGTH = 6;

export interface OtpInputProps extends Omit<AppTextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeCode: (code: string) => void;
  /** Called once six digits are present, so the form can submit itself. */
  onComplete?: (code: string) => void;
}

/**
 * The code field.
 *
 * One wide field rather than six boxes. Six boxes look like the design on
 * every OTP screen ever shipped and behave badly on React Native: backspace
 * between boxes, paste from the SMS, and a screen reader reading "edit text,
 * edit text, edit text" are each their own bug, and none of them buy the donor
 * anything. One field takes a paste, takes autofill, and reads as one thing.
 *
 * `oneTimeCode` is what lets iOS offer the code from the SMS above the
 * keyboard, and `sms-otp` does the same on Android -- the difference between
 * tapping once and switching apps to read six digits off a notification.
 *
 * Submitting on the sixth digit is deliberate: by then there is nothing left to
 * decide, and a donor who has to find the button afterwards is being asked to
 * confirm a decision they already made.
 */
export const OtpInput = forwardRef(function OtpInput(
  { value, onChangeCode, onComplete, ...props }: OtpInputProps,
  ref: ForwardedRef<TextInput>,
) {
  const { colors } = useTheme();

  return (
    <AppTextInput
      ref={ref}
      keyboardType="number-pad"
      inputMode="numeric"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      autoFocus
      maxLength={OTP_LENGTH}
      leading={<KeyRound size={18} color={colors.textMuted} />}
      value={value}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
        onChangeCode(digits);
        if (digits.length === OTP_LENGTH) onComplete?.(digits);
      }}
      style={{ fontSize: 24, letterSpacing: 8, fontWeight: '700' }}
      {...props}
    />
  );
});
