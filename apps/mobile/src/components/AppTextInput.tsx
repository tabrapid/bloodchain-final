import { ReactNode } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  trailing?: ReactNode;
  wrapperStyle?: ViewStyle;
}

/**
 * The reference design's glass `InputField`: label above, a bordered field
 * tinted with the theme's surface color, a trailing icon slot (password
 * show/hide), and per-field error text below instead of one block-level
 * error for the whole form.
 *
 * Deliberately NOT a `BlurView` like `GlassCard`/`IconButton`: a form with
 * several fields would mean several stacked blur views on one screen, and
 * `expo-blur`'s Android method is explicitly experimental -- stacking that
 * many caused the whole screen to render solid black and hang on Android
 * during the login/register transition. A solid `surfaceSolid` tint reads
 * close enough to the reference without the native rendering risk.
 */
export function AppTextInput({
  label,
  error,
  trailing,
  wrapperStyle,
  style,
  ...props
}: AppTextInputProps) {
  const { colors } = useTheme();
  const flattenedStyle = StyleSheet.flatten(style);

  return (
    <View style={[{ gap: spacing.xs }, wrapperStyle]}>
      {label && (
        <AppText muted style={{ fontSize: 13, fontWeight: '500' }}>
          {label}
        </AppText>
      )}
      <View
        style={{
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: 14,
        }}
      >
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[
            {
              padding: spacing.md,
              paddingRight: trailing ? 48 : spacing.md,
              color: colors.text,
              fontSize: 15,
            },
            flattenedStyle,
          ]}
          {...props}
        />
        {trailing && (
          <View
            style={{
              position: 'absolute',
              right: 14,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            {trailing}
          </View>
        )}
      </View>
      {error && (
        <AppText style={{ fontSize: 12, color: colors.danger }}>{error}</AppText>
      )}
    </View>
  );
}
