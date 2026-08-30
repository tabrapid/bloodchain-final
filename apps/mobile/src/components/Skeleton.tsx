import { DimensionValue, View } from 'react-native';
import { radius, useTheme } from '../theme';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm }: SkeletonProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: width as DimensionValue,
        height,
        borderRadius,
        backgroundColor: colors.surfaceElevated,
        opacity: 0.6,
      }}
    />
  );
}
