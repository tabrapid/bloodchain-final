import { ReactNode } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  trailing?: ReactNode;
  wrapperStyle?: ViewStyle;
}

/**
 * The reference design's glass `InputField`: label above, a real frosted
 * glass field (not the flat opaque `surfaceSolid` box screens used to roll
 * individually), a trailing icon slot (password show/hide), and per-field
 * error text below instead of one block-level error for the whole form.
 */
export function AppTextInput({
  label,
  error,
  trailing,
  wrapperStyle,
  style,
  ...props
}: AppTextInputProps) {
  const { colors, isDark } = useTheme();
  const flattenedStyle = StyleSheet.flatten(style);

  return (
    <View style={[{ gap: spacing.xs }, wrapperStyle]}>
      {label && (
        <AppText muted style={{ fontSize: 13, fontWeight: '500' }}>
          {label}
        </AppText>
      )}
      <View style={{ borderRadius: radius.sm, overflow: 'hidden' }}>
        <BlurView
          intensity={isDark ? 42 : 55}
          tint={colors.blurTint}
          experimentalBlurMethod="dimezisBlurView"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.glassBorder,
            borderRadius: radius.sm,
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
        </BlurView>
      </View>
      {error && (
        <AppText style={{ fontSize: 12, color: colors.danger }}>{error}</AppText>
      )}
    </View>
  );
}
