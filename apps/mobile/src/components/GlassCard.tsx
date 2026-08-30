import { PropsWithChildren } from 'react';
import { Platform, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius, spacing, useTheme } from '../theme';

export function GlassCard({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors, isDark } = useTheme();

  const content = (
    <View
      style={[
        {
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );

  const shadowWrapperStyle = {
    borderRadius: radius.md,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.4 : 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  };

  // expo-blur's real blur is native (UIVisualEffectView) on iOS. Its Android path is
  // still marked experimental upstream (perf/rendering issues warned in its own
  // types) and unverifiable here without a physical device, so Android renders the
  // same translucent tinted surface without the BlurView wrapper -- still reads as
  // glass, just without the live blur-behind-content effect.
  if (Platform.OS !== 'ios') {
    return <View style={shadowWrapperStyle}>{content}</View>;
  }

  return (
    <View style={shadowWrapperStyle}>
      <BlurView
        intensity={24}
        tint={colors.blurTint}
        style={{ borderRadius: radius.md, overflow: 'hidden' }}
      >
        {content}
      </BlurView>
    </View>
  );
}
