import { ReactNode, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Icon rendered at the leading edge, inside the field. */
  leading?: ReactNode;
  /** Slot at the trailing edge -- the password show/hide toggle. */
  trailing?: ReactNode;
  wrapperStyle?: ViewStyle;
}

/**
 * The design's glass input: one rounded field holding a leading icon, the
 * label stacked directly above the value, and a trailing slot.
 *
 * The label lives *inside* the field rather than floating above it. Above the
 * field, a column of label/field/label/field reads as twice as many elements
 * as there are; inside, each field is one object and the form gets visibly
 * shorter. It also leaves the label on screen once the field has a value,
 * which a placeholder-only field does not.
 *
 * Focus is a rose border plus a soft glow of the same colour -- the only
 * moment in a form where the accent belongs to a field rather than the button.
 *
 * Deliberately NOT a `BlurView` like `GlassCard`/`IconButton`: a form with
 * several fields would mean several stacked blur views on one screen, and
 * `expo-blur`'s Android method is explicitly experimental -- stacking that
 * many caused the whole screen to render solid black and hang on Android
 * during the login/register transition. A solid tint reads close enough
 * without the native rendering risk.
 */
export function AppTextInput({
  label,
  error,
  leading,
  trailing,
  wrapperStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: AppTextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const flattenedStyle = StyleSheet.flatten(style);

  const handleFocus = (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setFocused(true);
    onFocus?.(event);
  };

  // Chained, never replaced: react-hook-form registers its touched/validation
  // handler through `onBlur`, so swallowing it here would stop per-field
  // errors from ever appearing.
  const handleBlur = (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={wrapperStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: label ? 68 : 56,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor,
          borderRadius: 18,
          shadowColor: colors.primary,
          shadowOpacity: focused && !error ? 0.22 : 0,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {leading && <View style={{ width: 22, alignItems: 'center' }}>{leading}</View>}
        <View style={{ flex: 1, paddingVertical: 12 }}>
          {label && (
            <AppText muted style={{ fontSize: 12, fontWeight: '500', marginBottom: 3 }}>
              {label}
            </AppText>
          )}
          <TextInput
            placeholderTextColor={colors.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              {
                // Zeroed because the field's own padding positions the text --
                // Android's default input padding would offset it from the
                // label sitting right above it.
                padding: 0,
                color: colors.text,
                fontSize: 15,
              },
              flattenedStyle,
            ]}
            {...props}
          />
        </View>
        {trailing}
      </View>
      {error && (
        <AppText style={{ fontSize: 12, color: colors.danger, marginTop: spacing.xs }}>
          {error}
        </AppText>
      )}
    </View>
  );
}
