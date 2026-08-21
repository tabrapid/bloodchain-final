import { View } from 'react-native';
import { colors, radius } from '../theme';

export interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color = colors.primary, height = 6 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <View
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceElevated,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
