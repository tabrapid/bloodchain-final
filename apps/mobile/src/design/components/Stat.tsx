import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
import { fonts } from '../fonts';
import { icon as iconScale, motion, radius, space, type as typeScale, type AccentName } from '../tokens';
import { Text, ValueText } from './Text';

export interface StatProps {
  /** What the number is. Always present — a number with no label is a riddle. */
  label: string;
  value: string;
  /** Unit or qualifier: "ml", "days", "of 5". */
  unit?: string;
  icon?: (props: { size: number; color: string }) => ReactNode;
  tone?: AccentName;
  /** `sm` for a stat inside a row; `md` (default) for a stat row of its own. */
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

/**
 * One number and what it means.
 *
 * The label reads first and the value second. A column of large numbers above
 * small grey words makes the eye collect four numbers and then go back for
 * four meanings; label-first is read once.
 *
 * The whole thing is one accessible element, so a screen reader says "Donations
 * this year, 4" rather than "Donations this year" then "4" as separate stops.
 */
export function Stat({ label, value, unit, icon, tone, size = 'md', style }: StatProps) {
  const { colors } = useDesign();

  // A zero recedes: nothing is not an achievement and not a warning, and it
  // should read as quietly as it means. The value is still announced in full.
  const isZero = String(value).trim() === '0';
  const accent = tone && !isZero ? colors[tone] : null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`}
      style={[{ gap: space.xs, flex: 1 }, style]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.xs,
          // Room for two lines, so three stats keep one baseline whether their
          // labels wrap or not -- and in Russian they do.
          minHeight: typeScale.caption.lineHeight * 2,
        }}
      >
        {icon?.({ size: iconScale.sm, color: accent?.base ?? colors.textTertiary })}
        <Text variant="caption" tone="tertiary" numberOfLines={2} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <ValueText
          variant={size === 'sm' ? 'valueSm' : 'value'}
          style={accent ? { color: accent.text } : isZero ? { color: colors.textTertiary } : undefined}
        >
          {value}
        </ValueText>
        {unit ? (
          <Text variant="label" tone="tertiary">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A row of stats sharing the width, divided by hairlines rather than boxed
 * individually. Sits on a surface of its own by default; `bare` draws it on
 * whatever it is already inside.
 */
export function StatRow({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { colors } = useDesign();
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View
      style={
        bare
          ? { flexDirection: 'row' }
          : {
              flexDirection: 'row',
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
            }
      }
    >
      {items.map((child, index) => (
        <View key={index} style={{ flex: 1, flexDirection: 'row' }}>
          {index > 0 ? (
            <View style={{ width: 1, backgroundColor: colors.divider, marginRight: space.md, marginVertical: 2 }} />
          ) : null}
          <View style={{ flex: 1 }}>{child}</View>
        </View>
      ))}
    </View>
  );
}

export interface ProgressProps {
  /** 0 to 1. Clamped, because a server that returns 1.2 should not overflow the bar. */
  value: number;
  /** What the bar measures. Required: a bar with no label cannot be announced. */
  label: string;
  /** Shown at the right of the label row — "3 of 5", "60%". */
  caption?: string;
  tone?: AccentName;
  /** Hides the label row and draws the bar alone, for use inside a row that already says what it is. */
  bare?: boolean;
  /** Bar thickness. `thin` (4) inside rows; `regular` (6) on its own. */
  thickness?: 'thin' | 'regular';
}

/**
 * A linear progress bar.
 *
 * Announced as a `progressbar` with its real min/now/max, so an assistive
 * technology reads "60 percent" rather than describing a coloured rectangle.
 * The fill animates over `motion.quick`; anything slower feels like lag rather
 * than motion, and the brief here is calm, not sleepy.
 */
export function Progress({ value, label, caption, tone = 'rose', bare = false, thickness = 'regular' }: ProgressProps) {
  const { colors } = useDesign();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const width = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: motion.quick,
      // A width animation cannot run on the native driver; it is one view and
      // it moves once per data change, not per frame of a gesture.
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  const height = thickness === 'thin' ? 4 : 6;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ gap: space.sm }}
    >
      {bare ? null : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Text variant="label" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
          {caption ? (
            <Text variant="label" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
              {caption}
            </Text>
          ) : null}
        </View>
      )}
      <View style={{ height, borderRadius: radius.full, backgroundColor: colors.track, overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: colors[tone].base,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
    </View>
  );
}

export interface AvatarProps {
  /** The full name. Initials are derived; the name is what gets announced. */
  name: string;
  size?: number;
  /** A ring in an accent colour — used for verification state, never alone. */
  ring?: AccentName;
}

/**
 * Initials in a circle.
 *
 * No image support on purpose: the app has no avatar upload, and a component
 * with a `source` prop nothing can fill is an invitation to build the feature
 * by accident. Initials are derived from the name so two donors with the same
 * first name still differ.
 */
export function Avatar({ name, size = 44, ring }: AvatarProps) {
  const { colors } = useDesign();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.rose.soft,
        borderWidth: ring ? 2 : 0,
        borderColor: ring ? colors[ring].base : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.displayBold,
          fontSize: Math.round(size * 0.38),
          lineHeight: Math.round(size * 0.46),
          color: colors.rose.text,
          letterSpacing: -0.3,
        }}
      >
        {initials || '?'}
      </Text>
    </View>
  );
}
