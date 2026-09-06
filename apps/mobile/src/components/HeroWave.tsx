import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

export interface HeroWaveProps {
  /** Height of the wave band, in points. */
  height: number;
}

/**
 * The welcome screen's lower half: a band of the brand gradient whose top edge
 * is a single long curve, with one translucent crest riding over it.
 *
 * Two layers, not four. Every extra crest adds another edge for the eye to
 * follow across the screen, and four of them read as a slide template rather
 * than as one surface -- the calm comes from the band being one shape.
 *
 * The crest of the primary curve sits near the top of the viewBox, so the
 * `height` a caller passes is very nearly where the colour actually starts.
 * That is what lets the screen size this band from its own measured content
 * instead of a fraction of the window guessed per device.
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
          <Stop offset="0" stopColor={colors.heroGradient[0]} />
          <Stop offset="0.5" stopColor={colors.heroGradient[1]} />
          <Stop offset="1" stopColor={colors.heroGradient[2]} />
        </LinearGradient>
        <LinearGradient id="hero-wave-crest" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.03} />
        </LinearGradient>
      </Defs>

      <Path
        d="M0 74 C 96 12, 188 108, 274 66 C 328 40, 356 54, 390 34 L 390 520 L 0 520 Z"
        fill="url(#hero-wave-base)"
      />
      <Path
        d="M0 176 C 104 108, 190 208, 278 166 C 332 140, 358 156, 390 136 L 390 520 L 0 520 Z"
        fill="url(#hero-wave-crest)"
      />
    </Svg>
  );
}
