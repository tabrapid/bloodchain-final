import { PropsWithChildren } from 'react';
import { StyleSheet, Text, TextProps, type TextStyle } from 'react-native';
import { typography, useTheme } from '../theme';

export type AppTextVariant = keyof typeof typography;

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  muted?: boolean;
}

export function AppText({
  children,
  variant = 'body',
  muted = false,
  style,
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { colors } = useTheme();
  const own = StyleSheet.flatten(style) as TextStyle | undefined;

  const base: TextStyle = { color: muted ? colors.textMuted : colors.text, ...typography[variant] };

  // A call site that sets its own `fontSize` but no `lineHeight` would keep the
  // variant's line box. The default variant is `body` -- 15pt text in a 22pt
  // box -- so `style={{ fontSize: 28 }}` drew 28pt glyphs inside a 22pt line
  // and the tops were cut off, visibly: Home's overview tiles rendered "0" as
  // "U". Thirteen places in the app raise the size this way. When the size is
  // overridden and the height is not, the platform computes the line box.
  if (own?.fontSize !== undefined && own.lineHeight === undefined) {
    delete base.lineHeight;
  }

  return (
    <Text style={[base, style]} {...props}>
      {children}
    </Text>
  );
}
