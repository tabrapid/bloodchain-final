import { PropsWithChildren } from 'react';
import { Platform, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, spacing } from '../theme';

export function GlassCard({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const content = (
    <View
      style={[
        {
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.surfaceElevated,
          overflow: 'hidden',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={20} tint="dark" style={{ borderRadius: radius.md, overflow: 'hidden' }}>
        {content}
      </BlurView>
    );
  }

  return content;
}
