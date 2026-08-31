import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { radius, useTheme } from '../theme';

export interface ProgressBarProps {
  /** 0-100. */
  progress: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color, height = 6 }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, progress));

  // `clamped` is read straight from the worklet closure -- reanimated
  // auto-tracks it as a dependency and re-runs (with a smooth `withTiming`
  // transition) whenever it changes, no manual shared value/effect needed.
  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${clamped}%`, { duration: 700 }),
  }));

  return (
    <View
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceElevated,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: color ?? colors.primary,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
