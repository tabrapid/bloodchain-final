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

// react-native-reanimated's real implementation drives animations off the UI
// thread, so `withTiming` never resolves during a synchronous test render --
// components using it (ProgressBar, XpProgressBar) would snapshot at their
// initial value instead of the target. The library ships an official test
// mock (`withTiming`/`withSpring` resolve straight to their target value)
// for exactly this.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
