import { ForwardedRef, forwardRef } from 'react';
import { TextInput, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { AppText } from './AppText';
import { AppTextInput, type AppTextInputProps } from './AppTextInput';
import { spacing, useTheme } from '../theme';

/** How the nine national digits are grouped when they are written down. */
const GROUPS = [2, 3, 2, 2];

/**
 * The nine digits, spaced the way a number is printed and read aloud in
 * Uzbekistan: `90 123 45 67`.
 *
 * Formatting as the user types is not decoration. A nine-digit run is
 * genuinely hard to check for a typo, and a mistyped digit here means the code
 * goes to a stranger and the donor is left staring at a screen that is waiting
 * for an SMS that will never arrive.
 */
export function formatNationalDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '').slice(0, 9);
  const parts: string[] = [];
  let index = 0;
  for (const size of GROUPS) {
    if (index >= clean.length) break;
    parts.push(clean.slice(index, index + size));
    index += size;
  }
  return parts.join(' ');
}

export interface PhoneInputProps extends Omit<AppTextInputProps, 'value' | 'onChangeText'> {
  /** The nine national digits, unformatted. The parent's state is the truth. */
  value: string;
  onChangeDigits: (digits: string) => void;
}

/**
 * A phone field for a product used in one country.
 *
 * `+998` is printed inside the field rather than typed into it. Every donor
 * here has the same country code, so asking each of them to type it is four
 * keystrokes, four chances to get it wrong, and a decision ("with the plus or
 * without? with the eight?") that has no wrong answer we are willing to
 * explain. The field takes nine digits; the server is handed E.164.
 *
 * The keyboard is numeric and the content type is `telephoneNumber`, so the
 * platform offers the number it already knows.
 */
export const PhoneInput = forwardRef(function PhoneInput(
  { value, onChangeDigits, ...props }: PhoneInputProps,
  ref: ForwardedRef<TextInput>,
) {
  const { colors } = useTheme();

  return (
    <AppTextInput
      ref={ref}
      keyboardType="phone-pad"
      inputMode="tel"
      textContentType="telephoneNumber"
      autoComplete="tel"
      maxLength={13} // nine digits plus three separators
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Phone size={18} color={colors.textMuted} />
          <AppText style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>+998</AppText>
        </View>
      }
      value={formatNationalDigits(value)}
      onChangeText={(text) => onChangeDigits(text.replace(/\D/g, '').slice(0, 9))}
      {...props}
    />
  );
});
