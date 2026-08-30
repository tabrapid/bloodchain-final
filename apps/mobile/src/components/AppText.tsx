import { PropsWithChildren } from 'react';
import { Text, TextProps } from 'react-native';
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
  return (
    <Text
      style={[{ color: muted ? colors.textMuted : colors.text, ...typography[variant] }, style]}
      {...props}
    >
      {children}
    </Text>
  );
}
