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
    <View
      style={[
        {
          borderRadius: radius.xl,
          // A colored glow beneath the card, matching Create Design's
          // GradientCard shadow -- `shadowOpacity` scales whatever alpha
          // `shadowColor` already has, so an opaque hex color plus 0.35
          // opacity here reproduces its `rgba(color, 0.35)` glow exactly.
          shadowColor: resolvedColors[0],
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 10,
        },
        style,
      ]}
      {...props}
    >
      <LinearGradient
        colors={resolvedColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, overflow: 'hidden' }}
      >
        {/* Gloss overlay: a bright highlight across the top half, the same
            "liquid" cue Create Design's gloss layer gives every gradient card. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }}
          pointerEvents="none"
        />
        <View style={{ padding: spacing.md }}>{children}</View>
      </LinearGradient>
    </View>
  );
}
