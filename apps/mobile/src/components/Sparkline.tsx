import Svg, { Polyline } from 'react-native-svg';

export interface SparklineProps {
  /** Chronological data values -- at least 2 required to draw a line. */
  values: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * A minimal trend line for a hero card -- normalizes to a 0-100 x 0-`height`
 * viewBox with `preserveAspectRatio="none"` so it stretches to fill whatever
 * width its container gives it, without needing an `onLayout` measurement.
 */
export function Sparkline({ values, height = 40, color = '#FFFFFF', strokeWidth = 2 }: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);

  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
