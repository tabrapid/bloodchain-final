import { useEffect } from 'react';
import { DimensionValue, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, useTheme } from '../theme';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Shimmer placeholder for async content. */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const base = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const shimmer = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)';

  // The band sweeps a full card-width past each edge, so the highlight enters
  // and leaves cleanly instead of popping into existence mid-card.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value * 2 - 1) * 260 }],
  }));

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: base, overflow: 'hidden' },
        style,
      ]}
      pointerEvents="none"
    >
      <AnimatedGradient
        colors={['transparent', shimmer, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, sweepStyle]}
      />
    </View>
  );
}

/** Pre-composed row skeleton — matches the shape of a standard glass list row. */
export function SkeletonCard() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
      }}
    >
      <Skeleton width={40} height={40} borderRadius={radius.sm} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  );
}
