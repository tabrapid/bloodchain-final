import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, useTheme } from '../theme';

export interface GradientCardProps extends ViewProps {
  colors?: readonly [string, string, ...string[]];
}

export function GradientCard({
  children,
  style,
  colors: gradientColors,
  ...props
}: PropsWithChildren<GradientCardProps>) {
  const { colors } = useTheme();
  const resolvedColors = gradientColors ?? [colors.surfaceElevated, colors.surface];
  return (
    <View style={[{ borderRadius: radius.md, overflow: 'hidden' }, style]} {...props}>
      <LinearGradient
        colors={resolvedColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.md }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
