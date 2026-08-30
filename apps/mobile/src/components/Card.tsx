import { PropsWithChildren } from 'react';
import { Platform, View, ViewProps } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: Platform.OS === 'android' ? 2 : 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
