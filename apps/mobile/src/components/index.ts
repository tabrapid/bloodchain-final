/**
 * What is left of the pre-V2 component layer.
 *
 * Everything else that lived here was replaced by `src/design` in S11 and
 * deleted rather than left behind: two parallel component sets is how a
 * rebuilt app drifts back, one convenient import at a time.
 *
 * These three stay because they are not design-system components:
 *
 *   AppBackground  the root backdrop, mounted once above the navigator
 *   BrandMark      the logo
 *   map/LocationMap  react-native-maps, which cannot be re-exported from the
 *                  design system's barrel: it links a native module Expo Go
 *                  does not ship, so importing it there would crash every
 *                  screen the moment the app booted without a dev client
 */
export * from './AppBackground';
export * from './BrandMark';
