import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, useTheme, GlassTierTokens } from '../theme';

/**
 * The three glass tiers of the Create Design system, plus the rose-tinted
 * emergency variant. Each is a complete material — its own fill, border, blur
 * strength and shadow — which is what makes floating chrome read as physically
 * closer to the viewer than a settings row.
 */
export type GlassTier = 'nav' | 'elevated' | 'standard' | 'danger';

export interface GlassCardProps extends ViewProps {
  tier?: GlassTier;
  /** Shorthand for `tier="elevated"`, kept so existing call sites keep working. */
  elevated?: boolean;
  /** Shorthand for `tier="danger"`, kept so existing call sites keep working. */
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
 */
export function GlassCard({
  children,
  style,
  tier,
  elevated,
  danger,
  ...props
}: PropsWithChildren<GlassCardProps>) {
  const { colors, isDark } = useTheme();

  const resolvedTier: GlassTier = tier ?? (danger ? 'danger' : elevated ? 'elevated' : 'standard');

  // The danger variant borrows the standard tier's blur and geometry, and
  // overrides only fill, border and shadow -- an emergency card should read as
  // the same material as its neighbours, just rose-tinted.
  const base: GlassTierTokens = colors.glass[resolvedTier === 'danger' ? 'standard' : resolvedTier];

  const fill = resolvedTier === 'danger'
    ? isDark
      ? 'rgba(216,83,96,0.16)'
      : 'rgba(216,83,96,0.12)'
    : base.fill;

  const borderColor = resolvedTier === 'danger'
    ? isDark
      ? 'rgba(216,83,96,0.34)'
      : 'rgba(216,83,96,0.28)'
    : base.border;

  // The specular sheen is what sells "glass" rather than "blurred" -- but only
  // on the two upper tiers. A standard row carrying a lit top edge would read
  // as elevated, collapsing the tier distinction the design depends on.
  const showSheen = resolvedTier === 'nav' || resolvedTier === 'elevated';

  return (
    <View
      style={{
        borderRadius: radius.lg,
        shadowColor: resolvedTier === 'danger' ? colors.danger : '#000',
        shadowOpacity: resolvedTier === 'danger' ? 0.15 : base.shadowOpacity,
        shadowRadius: base.shadowRadius,
        shadowOffset: { width: 0, height: base.shadowOffsetY },
        elevation: base.elevation,
      }}
    >
      <BlurView
        intensity={base.blur}
        tint={colors.blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={{ borderRadius: radius.lg, overflow: 'hidden' }}
      >
        <View style={{ backgroundColor: fill }}>
          <View
            style={[
              {
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor,
                overflow: 'hidden',
              },
              style as object,
            ]}
            {...props}
          >
            {showSheen && (
              <LinearGradient
                colors={colors.glassSheen}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }}
                pointerEvents="none"
              />
            )}
            {children}
          </View>
        </View>
      </BlurView>
    </View>
  );
}
