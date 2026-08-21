import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../theme';

export interface GradientCardProps extends ViewProps {
  colors?: readonly [string, string, ...string[]];
}

export function GradientCard({
  children,
  style,
  colors: gradientColors = [colors.surfaceElevated, colors.surface],
  ...props
}: PropsWithChildren<GradientCardProps>) {
  return (
    <View style={[{ borderRadius: radius.md, overflow: 'hidden' }, style]} {...props}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.md }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
