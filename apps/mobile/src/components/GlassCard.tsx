import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, useTheme } from '../theme';

export interface GlassCardProps extends ViewProps {
  /** Brighter fill, for a card that should read as raised above its siblings. */
  elevated?: boolean;
  /** Red-tinted fill + border, for an alert/urgent card (e.g. SOS). */
  danger?: boolean;
}

/**
 * The app's default surface: a real translucent glass panel.
 *
 * Blur is enabled on Android too, via expo-blur's `dimezisBlurView` method.
 * Upstream marks it experimental, but without it Android renders a plain flat
 * card and the entire design language collapses -- which is exactly what
 * happened when this shipped iOS-only. The tradeoff (some overdraw cost) is
 * worth a design that actually exists on the platform most users are on.
 *
 * The top highlight gradient is what sells the "liquid" part: real glass
 * catches light along its upper edge, and a flat translucent fill does not.
 */
export function GlassCard({
  children,
  style,
  elevated,
  danger,
  ...props
}: PropsWithChildren<GlassCardProps>) {
  const { colors, isDark } = useTheme();

  const overlayColor = danger
    ? isDark
      ? 'rgba(216,83,96,0.18)'
      : 'rgba(216,83,96,0.12)'
    : elevated
    ? colors.surfaceHighlight
    : 'transparent';

  const borderColor = danger
    ? isDark
      ? 'rgba(216,83,96,0.4)'
      : 'rgba(216,83,96,0.32)'
    : colors.glassBorder;

  return (
    <View
      style={{
        borderRadius: radius.md,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.45 : 0.1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <BlurView
        intensity={isDark ? 42 : 55}
        tint={colors.blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={{ borderRadius: radius.md, overflow: 'hidden' }}
      >
        <View style={{ backgroundColor: overlayColor }}>
          {/* Specular highlight: brighter at the top edge, fading out downward. */}
          <LinearGradient
            colors={colors.glassSheen}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={[
              {
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor,
                overflow: 'hidden',
              },
              style as object,
            ]}
            {...props}
          >
            {children}
          </LinearGradient>
        </View>
      </BlurView>
    </View>
  );
}
