import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

export interface HeroWaveProps {
  /** Height of the wave band, in points. */
  height: number;
}

/**
 * The welcome screen's bottom half: a band of rose-to-violet colour whose top
 * edge is a pair of soft, overlapping curves.
 *
 * It is one shape with two lighter curves layered over it rather than a
 * gradient fade, because a fade has no edge and this needs one -- the curve is
 * what separates "the app's brand" below from "the app's content" above. Drawn
 * with `preserveAspectRatio="none"` so the curve stretches to any phone width
 * instead of being cropped on narrow ones.
 */
export function HeroWave({ height }: HeroWaveProps) {
  const { colors } = useTheme();

  return (
    <Svg
      style={[StyleSheet.absoluteFillObject, { top: undefined, height }]}
      width="100%"
      height={height}
      viewBox="0 0 390 520"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="hero-wave-base" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.ctaGradient[0]} stopOpacity={0.92} />
          <Stop offset="0.55" stopColor="#A2437F" stopOpacity={0.86} />
          <Stop offset="1" stopColor={colors.ctaGradient[1]} stopOpacity={0.8} />
        </LinearGradient>
        <LinearGradient id="hero-wave-crest" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* The band itself. */}
      <Path
        d="M0 148 C 78 78, 150 176, 232 140 C 300 110, 344 132, 390 108 L 390 520 L 0 520 Z"
        fill="url(#hero-wave-base)"
      />
      {/* Two crests riding over it, each a little further down, which is what
          gives the band depth instead of one flat silhouette. */}
      <Path
        d="M0 214 C 92 142, 168 240, 254 198 C 318 166, 350 190, 390 168 L 390 520 L 0 520 Z"
        fill="url(#hero-wave-crest)"
      />
      <Path
        d="M0 300 C 104 236, 186 322, 272 286 C 330 262, 356 278, 390 262 L 390 520 L 0 520 Z"
        fill="url(#hero-wave-crest)"
      />
    </Svg>
  );
}
