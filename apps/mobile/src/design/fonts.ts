import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';

/**
 * The typefaces of Bloodchain Mobile V4, and why there are two.
 *
 * One family cannot be both a calm reading face and a display face with
 * presence. Inter is superb at 13–16pt on a phone: neutral, wide apertures,
 * tabular figures. It is also anonymous at 28pt, which is why three previous
 * scales built entirely on it read as "software" rather than as a product.
 *
 * Manrope carries the identity: every title, every large number, the blood
 * type. It is geometric with a slightly narrow, low-contrast construction, so
 * at display sizes it reads as precise and modern without being decorative —
 * the register of a serious fintech or clinical product, not a game.
 *
 * Six faces, loaded by family name. `fontWeight` never appears in the scale:
 * asking Android for a numeric weight on top of a face that already has it
 * makes it synthesise one, and the result is the smeared, too-heavy text that
 * reads as amateur. A face is a file; there is nothing to interpret.
 */
export const fonts = {
  /** Body copy, hints, captions. */
  regular: 'Inter_400Regular',
  /** Labels, row values, tab labels. */
  medium: 'Inter_500Medium',
  /** Emphasis inside text, row titles, button labels. */
  semibold: 'Inter_600SemiBold',
  /** Section titles. */
  displaySemibold: 'Manrope_600SemiBold',
  /** Screen titles, sheet titles, clinical values. */
  displayBold: 'Manrope_700Bold',
  /** The hero: the blood type, the welcome headline. */
  displayExtraBold: 'Manrope_800ExtraBold',
} as const;

export type FontFamily = (typeof fonts)[keyof typeof fonts];

/**
 * Loads the six faces.
 *
 * Returns `false` until every one is in memory. The root layout holds the app
 * on its background colour while that is true rather than rendering text in a
 * fallback and re-laying it out a frame later -- a flash of Roboto followed by
 * a reflow is worse than a beat of nothing, and on a cold start it is the first
 * thing a donor sees.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // A font that fails to load is not a reason to show nothing forever. The app
  // proceeds on the system face and the error is visible in the log rather
  // than swallowed.
  if (error) {
    console.error('[fonts] typefaces failed to load; falling back to the system face:', error);
    return true;
  }

  return loaded;
}
