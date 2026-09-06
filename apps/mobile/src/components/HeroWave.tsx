import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

export interface HeroWaveProps {
  /** Height of the wave band, in points. */
  height: number;
}

/** The band's edge, as a path command. Three shapes are cut from this one curve. */
const CREST = 'M0 74 C 96 12, 188 108, 274 66 C 328 40, 356 54, 390 34';
/** The same curve lifted 36 units, for the glow that bleeds above the edge. */
const CREST_LIFTED = 'M0 38 C 96 -24, 188 72, 274 30 C 328 4, 356 18, 390 -2';
const CLOSE = 'L 390 520 L 0 520 Z';

/**
 * The welcome screen's lower half: a band of the brand gradient whose top edge
 * is a single long curve.
 *
 * Three shapes, all cut from that one curve, and each one is a *band* rather
 * than a fill:
 *
 * - a glow above the edge, so the band bleeds into the dark ground instead of
 *   being pasted onto it;
 * - the band itself;
 * - one translucent crest riding over it.
 *
 * The last two are the reason the earlier version looked dusty. Both closed to
 * the bottom of the viewBox with a flat white, so the "crest" was really a
 * white sheet over the whole lower half, and it lifted the brand rose into a
 * pale pink. Each overlay now fades out vertically within a hundred units of
 * its own curve, in `userSpaceOnUse` coordinates, so it reads as an edge and
 * the band below keeps its colour. The glow needs no such fade -- the opaque
 * band is painted over it, leaving only the sliver above the edge visible.
 *
 * The crest sits near the top of the viewBox, so the `height` a caller passes
 * is very nearly where the colour actually starts. That is what lets the
 * screen size this band from its own measured content instead of a fraction of
 * the window guessed per device.
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
        <LinearGradient
          id="hero-wave-glow"
          x1="0"
          y1="20"
          x2="0"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={colors.heroGradient[0]} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.heroGradient[0]} stopOpacity={0.5} />
        </LinearGradient>
        <LinearGradient
          id="hero-wave-crest"
          x1="0"
          y1="170"
          x2="0"
          y2="320"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.13} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <Path d={`${CREST_LIFTED} ${CLOSE}`} fill="url(#hero-wave-glow)" />
      <Path d={`${CREST} ${CLOSE}`} fill="url(#hero-wave-base)" />
      <Path
        d={`M0 176 C 104 108, 190 208, 278 166 C 332 140, 358 156, 390 136 ${CLOSE}`}
        fill="url(#hero-wave-crest)"
      />
    </Svg>
  );
}
