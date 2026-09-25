import { forwardRef, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type BlurEvent,
  type FocusEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, radius, space } from '../tokens';
import { Text } from './Text';
import { InlineError } from './Feedback';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Shown under the field when there is no error. */
  hint?: string;
  error?: string;
  /** Rendered inside the field at the leading edge. */
  leading?: ReactNode;
  /** Rendered inside the field at the trailing edge — a reveal toggle, a unit. */
  trailing?: ReactNode;
  required?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * The text field.
 *
 * The label sits ABOVE the field rather than inside it. V1 stacked the label
 * on the value inside one 68pt box, which made each field a single object and
 * the form shorter -- but it also meant the label and the value shared a
 * contrast budget, the field could not grow to two lines without the label
 * moving, and a screen reader announced them as one run of text. Above the
 * field is duller and correct.
 *
 * Focus is a border colour change and nothing else. V1 added a coloured glow;
 * on a form with six fields that is six halos competing with the submit button.
 *
 * The error, when there is one, replaces the hint rather than appearing beneath
 * it, so the field never changes height as you type -- which is what makes a
 * form jump under your thumb.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, leading, trailing, required, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useDesign();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const handleFocus = (event: FocusEvent) => {
    setFocused(true);
    onFocus?.(event);
  };
  // Chained, never replaced: react-hook-form registers its touched/validation
  // handler through onBlur, so swallowing it stops per-field errors appearing.
  const handleBlur = (event: BlurEvent) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = error ? colors.critical.base : focused ? colors.clinical.base : colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" tone="secondary" style={{ marginBottom: space.sm }}>
          {label}
          {required ? <Text variant="label" style={{ color: colors.critical.text }}>{' *'}</Text> : null}
        </Text>
      ) : null}

      {/* The whole field takes the tap, not just the text line: at 52pt tall
          with an icon inside it, most of what looks like the control was dead
          space you could press without anything happening. */}
      <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            minHeight: hitTarget.comfortable,
            paddingHorizontal: space.lg,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor,
            backgroundColor: colors.sunken,
          }}
        >
          {leading}
          <TextInput
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            accessibilityLabel={label}
            // The hint is guidance; the error is a failure. Announcing both as
            // one string is how a screen reader user ends up hearing the hint
            // when the field is wrong.
            accessibilityHint={error ? undefined : hint}
            placeholderTextColor={colors.textTertiary}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxFontSizeMultiplier={2}
            style={{
              flex: 1,
              paddingVertical: space.md,
              // Zeroed because the row's padding positions the text; Android's
              // default input padding would offset it from everything else.
              paddingHorizontal: 0,
              color: colors.textPrimary,
              fontSize: 16,
              lineHeight: 22,
            }}
            {...rest}
          />
          {trailing}
        </View>
      </Pressable>

      {error ? (
        <InlineError message={error} />
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export interface PasswordFieldProps extends Omit<FieldProps, 'secureTextEntry' | 'trailing'> {
  /** Announced on the reveal control while the password is hidden. */
  showLabel: string;
  /** Announced on it while the password is visible. */
  hideLabel: string;
}

/**
 * A password field with a reveal control.
 *
 * Four screens built this by hand -- sign in, register, reset password and
 * security -- each with its own `showPassword` state, its own hit area and, on
 * two of them, an icon with no accessible label at all. The labels are props
 * rather than fixed strings because "show password" belongs to the screen's
 * own namespace, not to the design system's.
 *
 * The toggle is a 44pt target with `hitSlop` on top of it: it sits inside a
 * field, where the visible icon has to stay small, and a 20pt icon is a 20pt
 * target unless someone says otherwise.
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { showLabel, hideLabel, ...rest },
  ref,
) {
  const { colors } = useDesign();
  const [shown, setShown] = useState(false);

  return (
    <Field
      ref={ref}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setShown((value) => !value)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ selected: shown }}
          accessibilityLabel={shown ? hideLabel : showLabel}
        >
          {shown ? (
            <EyeOff size={iconScale.md} color={colors.textTertiary} />
          ) : (
            <Eye size={iconScale.md} color={colors.textTertiary} />
          )}
        </Pressable>
      }
      {...rest}
    />
  );
});

export interface PhoneFieldProps extends Omit<FieldProps, 'keyboardType' | 'leading'> {
  /** The dialling prefix shown fixed at the leading edge, e.g. "+998". */
  prefix: string;
}

/**
 * A phone field with a fixed country prefix.
 *
 * The prefix is drawn, not typed. Uzbekistan numbers are always +998 here, and
 * a donor who has to type it is a donor who can type it wrong -- and who sees
 * their own number rejected without being told which part was the problem.
 */
export const PhoneField = forwardRef<TextInput, PhoneFieldProps>(function PhoneField({ prefix, ...rest }, ref) {
  const { colors } = useDesign();
  return (
    <Field
      ref={ref}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text variant="body" tone="secondary">
            {prefix}
          </Text>
          <View style={{ width: 1, height: 20, backgroundColor: colors.divider }} />
        </View>
      }
      {...rest}
    />
  );
});

export interface SearchFieldProps extends Omit<FieldProps, 'label'> {
  icon?: (props: { size: number; color: string }) => ReactNode;
  onClear?: () => void;
  clearLabel?: string;
}

/** A search box. Shorter than a Field, no label, and a clear affordance. */
export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { icon, onClear, clearLabel = 'Clear search', value, ...rest },
  ref,
) {
  const { colors } = useDesign();
  return (
    <Field
      ref={ref}
      value={value}
      returnKeyType="search"
      autoCorrect={false}
      leading={icon?.({ size: iconScale.md, color: colors.textTertiary })}
      trailing={
        value && onClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={onClear}
            hitSlop={12}
            style={{ padding: space.xs }}
          >
            <Text variant="body" tone="tertiary">
              ✕
            </Text>
          </Pressable>
        ) : undefined
      }
      {...rest}
    />
  );
});
