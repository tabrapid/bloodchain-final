import Svg, { Circle, Polyline } from 'react-native-svg';
import { View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
import { type AccentName } from '../tokens';

export interface SparklineProps {
  /** Chronological values. Fewer than two cannot describe a shape. */
  values: number[];
  height?: number;
  tone?: AccentName;
  /**
   * Required. A line drawing conveys nothing to a screen reader, so the caller
   * has to say in words what the shape means -- normally the same sentence the
   * sighted reader gets from the number beside it.
   */
  accessibilityLabel: string;
  style?: ViewStyle;
}

/**
 * The shape of a series, behind the number it belongs to.
 *
 * Deliberately not a chart: no axes, no gridlines, no tooltip. It answers one
 * question -- has this been going up or down -- and the screen that needs the
 * real answer links to the trends screen, which draws a real chart with a
 * reference range on it.
 *
 * Renders nothing below two points rather than drawing a dot or a flat line,
 * because a single measurement has no trend and a horizontal line claims it is
 * stable. The caller is expected to say "not enough measurements yet" instead.
 */
export function Sparkline({ values, height = 44, tone = 'rose', accessibilityLabel, style }: SparklineProps) {
  const { colors } = useDesign();

  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);

  // Inset so the stroke and the end dot are not clipped by the viewBox at the
  // extremes of the series.
  const top = 4;
  const usable = height - top * 2;

  const coords = values.map((value, index) => ({
    x: index * stepX,
    y: top + (usable - ((value - min) / range) * usable),
  }));
  const last = coords[coords.length - 1]!;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ height }, style]}
    >
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <Polyline
          points={coords.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={colors[tone].base}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // The viewBox is stretched horizontally, so a stroke scaled with it
          // would be thicker at the ends of a short series than a long one.
          vectorEffect="non-scaling-stroke"
        />
        <Circle cx={last.x} cy={last.y} r={2.5} fill={colors[tone].base} />
      </Svg>
    </View>
  );
}
