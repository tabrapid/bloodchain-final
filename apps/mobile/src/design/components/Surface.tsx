import { Platform, Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { useDesign } from '../useDesign';
import { elevation as elevationScale, radius as radiusScale, space, type ElevationName } from '../tokens';

export interface SurfaceProps extends ViewProps {
  level?: ElevationName;
  /** `md` is the default card corner; `lg` for sheets and full-bleed. */
  corner?: keyof typeof radiusScale;
  /** Inner padding. `false` for a surface whose children manage their own. */
  padded?: boolean | keyof typeof space;
  /** A hairline edge. On by default for `flat`, off for anything with a shadow. */
  bordered?: boolean;
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
 * Every opaque panel in V2.
 *
 * Three levels, and each says something:
 *
 *   flat      part of the page. Grouped lists, inline sections. Bordered.
 *   raised    a card: a thing you could pick up and move. The common case.
 *   floating  above the page: sheets, menus, the tab bar.
 *
 * Uniform elevation on everything is the same as no elevation -- nothing is
 * more important than anything else and the eye has nowhere to land. V1 made
 * everything a card; this is the fix, and using it means choosing.
 *
 * Android gets no shadow on purpose. It derives the shadow from the view's
 * outline, and on a surface whose fill lives in a child that degrades into a
 * hard grey rectangle drawn inside the card. That was reported four times
 * across separate builds in V1. The border carries the separation instead, and
 * `bordered` defaults to on wherever the shadow is doing nothing.
 */
export function Surface({
  level = 'raised',
  corner = 'md',
  padded = true,
  bordered,
  onPress,
  disabled = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { colors } = useDesign();
  const e = elevationScale[level];

  const shadowless = Platform.OS === 'android' || level === 'flat';
  const showBorder = bordered ?? shadowless;

  const padding = padded === false ? 0 : padded === true ? space.lg : space[padding_(padded)];

  const frame: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radiusScale[corner],
    padding,
    borderWidth: showBorder ? 1 : 0,
    borderColor: colors.divider,
    opacity: disabled ? 0.5 : 1,
    ...(Platform.OS === 'ios' && e.shadowOpacity > 0
      ? {
          shadowColor: '#000',
          shadowOpacity: e.shadowOpacity,
          shadowRadius: e.shadowRadius,
          shadowOffset: { width: 0, height: e.shadowOffsetY },
        }
      : null),
  };

  if (!onPress) {
    return (
      <View style={[frame, style as ViewStyle]} {...rest}>
        {children}
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
        pressed ? { backgroundColor: colors.surfacePressed } : null,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function padding_(value: Exclude<SurfaceProps['padded'], boolean | undefined>): keyof typeof space {
  return value;
}

/**
 * An inset well: the visual opposite of a Surface.
 *
 * Used where content belongs *below* the page rather than above it -- an input
 * field's interior, a read-only value block, an inline result list. Having both
 * directions is what lets a screen show grouping without adding another card.
 */
export function Well({ corner = 'sm', padded = true, style, children, ...rest }: SurfaceProps) {
  const { colors } = useDesign();
  const padding = padded === false ? 0 : padded === true ? space.md : space[padding_(padded)];

  return (
    <View
      style={[
        {
          backgroundColor: colors.sunken,
          borderRadius: radiusScale[corner],
          padding,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
