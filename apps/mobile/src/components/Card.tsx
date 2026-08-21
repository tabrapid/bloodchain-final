import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
