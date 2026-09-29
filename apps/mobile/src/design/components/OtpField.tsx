import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useDesign } from '../useDesign';
import { hitTarget, radius, space } from '../tokens';
import { Text } from './Text';
import { InlineError } from './Feedback';

export interface OtpFieldProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  /** Fired once the last digit lands, so the donor never presses a submit button. */
  onComplete?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** Announced as the purpose of the field. */
  accessibilityLabel: string;
  autoFocus?: boolean;
}

/**
 * The one-time-code field.
 *
 * Boxes are drawn, but there is exactly ONE `TextInput` behind them, stretched
 * invisibly across the row. That is what makes platform autofill work: iOS
 * offers "From Messages" above the keyboard for a field with
 * `textContentType="oneTimeCode"`, and Android's SMS Retriever fills a field
 * with `autoComplete="sms-otp"` -- both of which deliver the whole code at
 * once, into one field. Six separate inputs silently break both.
 *
 * It submits itself on the last digit. Asking someone to press "Verify" after
 * typing six digits that can only mean one thing is a button that exists to be
 * pressed rather than to decide anything.
 */
export function OtpField({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  accessibilityLabel,
  autoFocus = true,
}: OtpFieldProps) {
  const { colors } = useDesign();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    if (value.length < length) completed.current = false;
    if (value.length === length && !completed.current) {
      completed.current = true;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  // The box the next digit lands in, which is the one to highlight.
  const activeIndex = Math.min(value.length, length - 1);
  const boxHeight = hitTarget.comfortable + 8;

  return (
    <View>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' }}
      >
        {digits.map((digit, index) => {
          const isActive = focused && index === activeIndex && !disabled;
          return (
            <View
              key={index}
              // Individually hidden: the single input below carries the
              // accessible value, and announcing six empty boxes on top of it
              // is noise.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flex: 1,
                height: boxHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: error ? colors.critical.base : isActive ? colors.clinical.base : 'transparent',
                backgroundColor: colors.surfaceRaised,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {digit ? (
                <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>
                  {digit}
                </Text>
              ) : isActive ? (
                <View style={{ width: 2, height: 24, borderRadius: 1, backgroundColor: colors.clinical.base }} />
              ) : (
                <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: colors.track }} />
              )}
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        maxLength={length}
        // The two that make autofill work, one per platform.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        // Transparent and stretched over the boxes rather than
        // `display: none`: a field with no layout is not focusable on Android
        // and is skipped by autofill on both platforms.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: boxHeight,
          opacity: 0,
          color: 'transparent',
        }}
        caretHidden
      />

      {error ? <InlineError message={error} /> : null}
    </View>
  );
}
