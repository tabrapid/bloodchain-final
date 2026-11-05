/* eslint-env jest */

// react-native-safe-area-context needs a native module to resolve real insets.
// The library ships an official jest mock that returns static insets instead.
// (the shipped mock is a default export, hence `.default`)
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// lucide-react-native renders real SVG elements, which pull in react-native-svg's
// native side. The screens under test only care that an icon is *placed*, not how
// it draws, so render each icon as a plain host view tagged with its name.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return new Proxy(
    {},
    {
      get: (_target, iconName) => {
        if (iconName === '__esModule') return true;
        const Icon = (props) => React.createElement(View, { testID: `icon-${String(iconName)}`, ...props });
        Icon.displayName = String(iconName);
        return Icon;
      },
    },
  );
});

// expo-blur's BlurView is a native component; GlassCard only uses it as a wrapper.
jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }) => React.createElement(View, props, children),
  };
});

// react-native-maps 1.27 asks the TurboModule registry for 'RNMapsAirModule'
// at import time and throws when it is absent -- which it always is under
// jest, there being no native binary. That takes down every suite that
// reaches a screen importing LocationMap, map or no map on screen. Same
// treatment as expo-blur above: the tests care that a map is placed and what
// is placed on it, not how it draws.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MapView = React.forwardRef(({ children, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      // The component calls this to frame multiple markers; it has no visible
      // effect to assert, but it must exist or the effect throws.
      fitToCoordinates: () => {},
      animateToRegion: () => {},
    }));
    return React.createElement(View, { testID: 'map-view', ...props }, children);
  });
  MapView.displayName = 'MapView';

  const marker = (testID) => {
    const Component = ({ children, ...props }) =>
      React.createElement(View, { testID, ...props }, children);
    Component.displayName = testID;
    return Component;
  };

  return {
    __esModule: true,
    default: MapView,
    MapView,
    Marker: marker('map-marker'),
    Polyline: marker('map-polyline'),
    Callout: marker('map-callout'),
    PROVIDER_DEFAULT: undefined,
    PROVIDER_GOOGLE: 'google',
  };
});

// react-native-reanimated's real implementation drives animations off the UI
// thread, so `withTiming` never resolves during a synchronous test render --
// components using it (ProgressBar, XpProgressBar) would snapshot at their
// initial value instead of the target. The library ships an official test
// mock (`withTiming`/`withSpring` resolve straight to their target value)
// for exactly this.
// Reanimated 4 moved its worklet runtime out into react-native-worklets, and
// `react-native-reanimated/mock` imports the real one on the way in -- which
// throws "Native part of Worklets doesn't seem to be initialized" the moment a
// suite touches any animated component, taking 14 of 34 suites down with it.
// Worklets ships its own mock for exactly this; it has to be registered first
// so reanimated's mock resolves to it rather than to the native module.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Screen tests assert the English copy they were written against. The language
// provider follows the device when it speaks one of ours, and a test runner
// reports whatever locale the machine has -- so pin detection here and let the
// localisation specs, which mock this module themselves, override it.
jest.mock('@bloodchain/i18n', () => {
  const actual = jest.requireActual('@bloodchain/i18n');
  return { ...actual, detectPlatformLocales: () => ['en-US'] };
});

// The typefaces never load under jest -- there is no native font module and no
// file system to read a TTF from -- so `useFonts` would sit at `false` forever
// and the root layout would correctly hold the app on its background colour,
// which is not what any of these tests are about. Reporting the faces as loaded
// lets every screen test assert the screen.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: () => Promise.resolve(),
  isLoaded: () => true,
}));
jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
}));
jest.mock('@expo-google-fonts/manrope', () => ({
  Manrope_600SemiBold: 'Manrope_600SemiBold',
  Manrope_700Bold: 'Manrope_700Bold',
  Manrope_800ExtraBold: 'Manrope_800ExtraBold',
}));
