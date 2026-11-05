import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from './components/Chrome';
import { ThemeProvider } from '../theme';

/**
 * The V2 tab bar, carrying forward what its V1 predecessor was written to
 * prove.
 *
 * P0-32 was caused by React Navigation's default bar auto-registering every
 * route as a visible tab. The custom bar fixed it, and then had to keep on
 * fixing it: `state.routes` is EVERY route in the navigator, including the
 * dozen pushed screens marked `href: null`, and a bar that iterates it
 * blindly lays out a flex cell for all of them.
 */
function buildProps(routeNames: string[], focusedIndex: number, hidden: string[] = []) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));

  const routes = routeNames.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        // Mirrors what Expo Router actually produces for `href: null` --
        // the route stays in `state.routes`, it just gets a null button and
        // a display:none item style.
        options: hidden.includes(route.name)
          ? {
              title: route.name,
              tabBarItemStyle: { display: 'none' as const },
              tabBarButton: () => null,
            }
          : {
              title: route.name,
              tabBarIcon: () => <Text>{`icon-${route.name}`}</Text>,
            },
      },
    ]),
  );

  return {
    props: {
      state: { routes, index: focusedIndex } as never,
      descriptors: descriptors as never,
      navigation: { navigate, emit } as never,
      insets: { top: 0, bottom: 0, left: 0, right: 0 } as never,
    },
    navigate,
    emit,
  };
}

function renderBar(props: ReturnType<typeof buildProps>['props']) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <TabBar {...props} />
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });
  return tree!;
}

/**
 * The bar's tabs.
 *
 * Matched on what the component declares -- role `tab`, with a handler --
 * rather than on the component object: React Native wraps Pressable in
 * `React.memo`, and comparing against the exported memo matches nothing.
 */
function tabs(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(
    (node) => node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
  );
}

describe('TabBar', () => {
  it('renders exactly one tab per route it is given, never more', () => {
    const { props } = buildProps(
      ['home', 'health', 'donate', 'community', 'calendar', 'profile'],
      0,
    );
    expect(tabs(renderBar(props))).toHaveLength(6);
  });

  it('renders exactly three for the courier navigator', () => {
    const { props } = buildProps(['active', 'history', 'profile'], 0);
    expect(tabs(renderBar(props))).toHaveLength(3);
  });

  it('navigates to an unfocused tab on press', () => {
    const { props, navigate, emit } = buildProps(['home', 'health'], 0);
    const found = tabs(renderBar(props));
    act(() => {
      found[1]!.props.onPress();
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'health-key' }),
    );
    expect(navigate).toHaveBeenCalledWith('health');
  });

  it('does not navigate when pressing the already-focused tab', () => {
    const { props, navigate } = buildProps(['home', 'health'], 0);
    const found = tabs(renderBar(props));
    act(() => {
      found[0]!.props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * The real donor navigator registers ~19 routes and marks 13 of them
   * `href: null`. Those still arrive in `state.routes`, so the six real icons
   * would be squeezed into the left edge with 13 blank cells trailing off to
   * the right -- which is exactly how this shipped once.
   */
  it('renders no tab for routes hidden with href: null', () => {
    const { props } = buildProps(
      [
        'home',
        'health',
        'donate',
        'community',
        'calendar',
        'profile',
        'notifications',
        'privacy',
        'security',
      ],
      0,
      ['notifications', 'privacy', 'security'],
    );
    expect(tabs(renderBar(props))).toHaveLength(6);
  });

  it('keeps the selection on the right tab when hidden routes precede it', () => {
    // 'hidden-a' sits at index 1, so the focused route 'donate' is at index 3
    // of the full list but index 2 of the visible one. Comparing array indices
    // instead of route keys would select the wrong tab.
    const { props } = buildProps(['home', 'hidden-a', 'health', 'donate'], 3, ['hidden-a']);
    const found = tabs(renderBar(props));

    expect(found).toHaveLength(3);
    expect(found[2]!.props.accessibilityState).toEqual({ selected: true });
    expect(found[0]!.props.accessibilityState).toEqual({ selected: false });
  });

  it('navigates correctly when hidden routes shift the visible indices', () => {
    const { props, navigate } = buildProps(['home', 'hidden-a', 'health', 'donate'], 0, ['hidden-a']);
    const found = tabs(renderBar(props));
    act(() => {
      found[1]!.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('health');
  });
});

/**
 * The V4 bar is opaque.
 *
 * `expo-blur` on Android samples what is drawn beneath it, and over a
 * navigator that sample is often unavailable, at which point the platform
 * draws a flat tinted plate. A blur that is a grey plate on the bad day is a
 * bet with no upside on the one component a donor sees on every screen. The
 * bar is a composed opaque tone with a hairline above it -- which is also what
 * a native tab bar looks like.
 */
describe('the tab bar is opaque', () => {
  it('mounts no BlurView', () => {
    const { BlurView } = require('expo-blur');
    const { props } = buildProps(['home', 'health', 'donate'], 0);
    expect(renderBar(props).root.findAllByType(BlurView)).toHaveLength(0);
  });
});

/**
 * The bar labelled only the tab you were already on, which is the one tab you
 * do not need told. Five unlabelled glyphs is a guess -- a droplet next to a
 * heart, a calendar next to a person -- so every tab carries its name.
 */
describe('every tab is labelled', () => {
  it('renders a label for unfocused tabs, not just the focused one', () => {
    const { props } = buildProps(['home', 'health', 'donate'], 0);
    const tree = renderBar(props);

    for (const name of ['home', 'health', 'donate']) {
      expect(tree.root.findAll((node) => node.children.includes(name)).length).toBeGreaterThan(0);
    }
  });
});
