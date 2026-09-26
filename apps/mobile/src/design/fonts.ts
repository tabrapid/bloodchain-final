import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';

/**
 * The typeface, and why it is loaded by name rather than by weight.
 *
 * Until V3 the app loaded no font at all. Every word on Android was stock
 * Roboto at whatever weight the platform decided `fontWeight: '600'` meant --
 * and on Android that is the least reliable value in the set, because Roboto
 * ships Regular, Medium and Bold and the framework picks among them. The V2
 * scale leaned on `600` for `h2`, `h3`, `bodyStrong`, `overline` and the
 * focused tab label, so when it resolved toward Regular the hierarchy went with
 * it. That is most of why the app read as flat on a real phone while the
 * browser captures looked fine: Chromium had its own font and its own weight
 * synthesis, and neither was what the device did.
 *
 * So weights are FAMILIES here, never numbers. `Inter_600SemiBold` is a file;
 * there is nothing for the platform to interpret and nothing for it to
 * synthesise. `fontWeight` is deliberately absent from the scale — setting both
 * asks Android to fake a weight on top of a face that already has it, which is
 * how you get the smeared, slightly-too-heavy look that reads as amateur.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontFamily = (typeof fonts)[keyof typeof fonts];

/**
 * Loads the four faces.
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
    Inter_700Bold,
  });

  // A font that fails to load is not a reason to show nothing forever. The app
  // proceeds on the system face, which is exactly where V2 was, and the error
  // is visible in the log rather than swallowed.
  if (error) {
    console.error('[fonts] Inter failed to load; falling back to the system face:', error);
    return true;
  }

  return loaded;
}
