import { Platform, Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesign } from '../useDesign';
import {
  elevation as elevationScale,
  radius as radiusScale,
  space,
  type AccentName,
  type ElevationName,
} from '../tokens';

export interface SurfaceProps extends ViewProps {
  level?: ElevationName;
  /** `lg` is the default card corner; `xl` for sheets and the hero. */
  corner?: keyof typeof radiusScale;
  /** Inner padding. `false` for a surface whose children manage their own. */
  padded?: boolean | keyof typeof space;
  /** A hairline edge. Off by default: in V4 a border means "takes input". */
  bordered?: boolean;
  /**
   * Tints the surface with an accent's soft ground.
   *
   * For a block whose whole meaning is a state -- "you can donate today", "a
   * result needs attention". Never for decoration: a tinted card that means
   * nothing spends the colour a real state would need.
   */
  tone?: AccentName;
  /**
   * The identity hero. The one gradient in the system: a deep rose-plum that
   * fades into the surface colour. Used by the donor's identity block and
   * nowhere else.
   */
  hero?: boolean;
  /**
   * Makes the whole card the tap target.
   *
   * With it, `accessibilityLabel` is required: a card wraps several pieces of
   * text and a screen reader would otherwise announce the pile of them and no
   * indication that any of it is a button.
   */
  onPress?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Every opaque panel in V4.
 *
 * Three levels, and each says something:
 *
 *   flat      part of the page: a grouped list, an inline block. Surface tone,
 *             nothing else.
 *   raised    a card: a distinct object. Surface tone, a hairline of light on
 *             its top edge, and on iOS a soft shadow.
 *   floating  above the page: sheets, menus, the tab bar. Raised tone and a
 *             real shadow on both platforms.
 *
 * No border at rest. Three previous systems outlined every card, and an
 * outline on every card is the "wall of identical rounded rectangles" the
 * product owner kept seeing. Tone separates a surface from the page; the top
 * highlight says it is lit from above; a border is reserved for controls.
 */
export function Surface({
  level = 'raised',
  corner = 'lg',
  padded = true,
  bordered = false,
  tone,
  hero = false,
  onPress,
  disabled = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { colors, isDark } = useDesign();
  const e = elevationScale[level];

  const androidElevation = Platform.OS === 'android' ? e.android : 0;
  const padding = padded === false ? 0 : padded === true ? space.lg : space[padded];
  const cornerRadius = radiusScale[corner];

  const background = tone
    ? colors[tone].soft
    : level === 'floating'
      ? colors.surfaceRaised
      : colors.surface;

  const frame: ViewStyle = {
    backgroundColor: hero ? colors.surface : background,
    borderRadius: cornerRadius,
    borderWidth: bordered ? 1 : 0,
    borderColor: colors.border,
    opacity: disabled ? 0.5 : 1,
    // The gradient and the highlight are children that must not spill past
    // the corner.
    overflow: 'hidden',
    ...(Platform.OS === 'ios' && e.shadowOpacity > 0
      ? {
          shadowColor: '#000',
          shadowOpacity: e.shadowOpacity,
          shadowRadius: e.shadowRadius,
          shadowOffset: { width: 0, height: e.shadowOffsetY },
        }
      : null),
    ...(androidElevation > 0 ? { elevation: androidElevation } : null),
  };

  // The light along the top edge. Only a raised surface on a dark page has
  // one: a flat block is part of the page and a light surface is already lit.
  const lit = isDark && level !== 'flat' && !tone;

  const inner = (
    <>
      {hero ? (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.heroGradient[0], colors.heroGradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {lit ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.highlight }}
        />
      ) : null}
      <View style={{ padding }}>{children}</View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[frame, style as ViewStyle]} {...rest}>
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        frame,
        pressed && !hero ? { backgroundColor: colors.surfacePressed } : null,
        pressed && hero ? { opacity: 0.88 } : null,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {inner}
    </Pressable>
  );
}

/**
 * An inset well: the visual opposite of a Surface.
 *
 * Used where content belongs *below* the page rather than above it -- a
 * read-only value block, an inline result list, a quotation from the server.
 * Having both directions is what lets a screen show grouping without adding
 * another card.
 */
export function Well({ corner = 'md', padded = true, style, children, ...rest }: SurfaceProps) {
  const { colors } = useDesign();
  const padding = padded === false ? 0 : padded === true ? space.md : space[padded];

  return (
    <View
      style={[
        {
          backgroundColor: colors.sunken,
          borderRadius: radiusScale[corner],
          padding,
        },
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/**
 * A rounded tinted square with an icon in it: the leading element of a row, a
 * feature marker, an empty-state glyph.
 *
 * One component, because every screen that drew one by hand chose a different
 * size and a different tint opacity, and a list of rows whose icon tiles are
 * 32, 36 and 40pt looks assembled rather than designed.
 */
export function IconTile({
  icon,
  tone,
  size = 36,
  style,
}: {
  icon: (props: { size: number; color: string }) => ReactNode;
  /** Accent tint. Omit for a neutral tile. */
  tone?: AccentName;
  size?: 32 | 36 | 40 | 48 | 56;
  style?: ViewStyle;
}) {
  const { colors } = useDesign();
  const accent = tone ? colors[tone] : null;
  const iconSize = size >= 48 ? 26 : size >= 40 ? 22 : 20;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size >= 48 ? radiusScale.md : radiusScale.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accent ? accent.soft : colors.surfaceRaised,
        },
        style,
      ]}
    >
      {icon({ size: iconSize, color: accent ? accent.base : colors.textSecondary })}
    </View>
  );
}
