import { PropsWithChildren, useMemo } from 'react';
import { StyleSheet, View, ViewProps, type ViewStyle } from 'react-native';
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
 * Style properties that position the card in its parent rather than describing
 * its interior. A card is three stacked views -- a shadow wrapper, the blur,
 * and the bordered content box -- and these have to land on the outermost one.
 *
 * They used to land on the innermost, which meant a call site passing
 * `marginTop: 32` inset the *content box* 32px inside a full-size blur panel:
 * one large faint rectangle with a smaller bordered card floating inside it,
 * on all 21 cards in the app that pass a margin. Padding, borders and the
 * content layout still belong to the inner box, so the split is by property,
 * not by picking one view and hoping.
 */
const OUTER_STYLE_KEYS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'position', 'top', 'bottom', 'left', 'right', 'start', 'end', 'zIndex',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'transform', 'opacity', 'display',
]);

function splitStyle(style: ViewStyle | undefined): { outer: ViewStyle; inner: ViewStyle } {
  const outer: ViewStyle = {};
  const inner: ViewStyle = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    (OUTER_STYLE_KEYS.has(key) ? outer : inner)[key as keyof ViewStyle] = value as never;
  }
  return { outer, inner };
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

  const { outer, inner } = useMemo(
    () => splitStyle(StyleSheet.flatten(style) as ViewStyle | undefined),
    [style],
  );

  // A call site overriding the corner has to change all three layers, or the
  // blur clips to one radius while the border draws another.
  const cornerRadius = inner.borderRadius ?? radius.lg;

  return (
    <View
      style={[
        {
          borderRadius: cornerRadius,
          shadowColor: resolvedTier === 'danger' ? colors.danger : '#000',
          shadowOpacity: resolvedTier === 'danger' ? 0.15 : base.shadowOpacity,
          shadowRadius: base.shadowRadius,
          shadowOffset: { width: 0, height: base.shadowOffsetY },
          elevation: base.elevation,
        },
        outer,
      ]}
    >
      <BlurView
        intensity={base.blur}
        tint={colors.blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={{ borderRadius: cornerRadius, overflow: 'hidden' }}
      >
        {/* Fill, border and padding on one view. These were two nested views,
            which bought nothing and added a compositing layer to every card on
            a screen that already stacks a blur pass per card. */}
        <View
          style={[
            {
              backgroundColor: fill,
              borderRadius: cornerRadius,
              padding: spacing.md,
              borderWidth: 1,
              borderColor,
              overflow: 'hidden',
            },
            inner,
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
      </BlurView>
    </View>
  );
}
