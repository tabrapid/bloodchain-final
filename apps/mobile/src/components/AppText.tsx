import { PropsWithChildren } from 'react';
import { Text, TextProps } from 'react-native';
import { colors, typography } from '../theme';

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
  return (
    <Text
      style={[{ color: muted ? colors.textMuted : colors.text, ...typography[variant] }, style]}
      {...props}
    >
      {children}
    </Text>
  );
}
