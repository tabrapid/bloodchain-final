import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
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
  style?: ViewStyle;
}

/**
 * One number and what it means.
 *
 * The label reads first and the value second, which is the opposite of how V1
 * drew it. A column of large numbers above small grey words makes the eye
 * collect four numbers and then go back for four meanings; label-first is read
 * once.
 *
 * The whole thing is one accessible element, so a screen reader says "Donations
 * this year, 4" rather than "Donations this year" then "4" as separate stops.
 */
export function Stat({ label, value, unit, icon, tone, style }: StatProps) {
  const { colors } = useDesign();

  /*
    A zero recedes.

    "Emergency responses: 0" was drawn in the same weight and the same accent as
    "Donations: 3", so a donor who has never responded to an emergency got a
    number shouting at them about something that has not happened. Nothing is
    not an achievement and it is not a warning; it is the absence of data, and
    it should read as quietly as it means. The value is still announced in full
    to a screen reader -- this changes how it looks, not what it says.
  */
  const isZero = String(value).trim() === '0';
  const accent = tone && !isZero ? colors[tone] : null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`}
      style={[{ gap: space.xs, flex: 1 }, style]}
    >
      {/*
        Two lines, and room reserved for both.

        A row of three stats at 393pt gives each label about 100pt, and
        "Emergency responses" is longer than that in English before Russian and
        Uzbek make it longer still -- so a single clipped line read "Emergency
        r…". Wrapping fixes the clipping; reserving the height keeps the three
        numbers on one baseline whether the labels wrap or not.
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.xs,
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
          style={
            accent ? { color: accent.text } : isZero ? { color: colors.textTertiary } : undefined
          }
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

/** A row of stats sharing the width, divided rather than boxed. */
export function StatRow({ children }: { children: ReactNode }) {
  const { colors } = useDesign();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.lg,
        padding: space.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
      }}
    >
      {children}
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
}

/**
 * A linear progress bar.
 *
 * Announced as a `progressbar` with its real min/now/max, so an assistive
 * technology reads "60 percent" rather than describing a coloured rectangle.
 * The fill animates over `motion.quick`; anything slower feels like lag rather
 * than motion, and the brief here is calm, not sleepy.
 */
export function Progress({ value, label, caption, tone = 'rose', bare = false }: ProgressProps) {
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
            <Text variant="label" tone="tertiary">
              {caption}
            </Text>
          ) : null}
        </View>
      )}
      <View style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.track, overflow: 'hidden' }}>
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
        backgroundColor: colors.surfaceRaised,
        borderWidth: ring ? 2 : 1,
        borderColor: ring ? colors[ring].base : colors.divider,
      }}
    >
      <Text variant={size >= 56 ? 'h2' : 'bodyStrong'} tone="secondary">
        {initials || '?'}
      </Text>
    </View>
  );
}
