import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

export interface BrandMarkProps {
  size?: number;
}

/**
 * The app's mark: a droplet drawn as a thick gradient outline rather than a
 * solid glyph in a tinted square.
 *
 * A filled icon inside a rounded square is a *button*; every other tappable
 * surface in the app looks like that. The mark on the welcome screen is the
 * one thing on the screen that is not an affordance, so it is drawn as a shape
 * in its own right -- hollow, so the backdrop reads through it, in the same
 * rose-to-violet the wave band below it uses.
 */
export function BrandMark({ size = 96 }: BrandMarkProps) {
  const { colors } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        {/* The same three stops the wave band uses. The mark drawn in the
            two-stop CTA blend read a shade brighter and more violet than the
            band right below it, which is the sort of near-miss that makes a
            brand look assembled rather than designed. */}
        <LinearGradient id="brand-mark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.heroGradient[0]} />
          <Stop offset="0.5" stopColor={colors.heroGradient[1]} />
          <Stop offset="1" stopColor={colors.heroGradient[2]} />
        </LinearGradient>
      </Defs>
      {/*
        A teardrop: a point at the top, two symmetric flanks falling away from
        it, closed by a circular bowl. Stroked, never filled -- the hollow is
        the mark.
      */}
      <Path
        d="M24 4 C24 4 8 19.5 8 29 a16 16 0 0 0 32 0 C40 19.5 24 4 24 4 Z"
        stroke="url(#brand-mark)"
        strokeWidth={5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
