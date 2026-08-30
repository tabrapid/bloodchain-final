import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlassTabBar } from './GlassTabBar';
import { ThemeProvider } from '../theme';

/**
 * GlassTabBar replaced React Navigation's default bar entirely (P0-32 was
 * caused by the default bar auto-registering every route as a visible tab).
 * This asserts the custom bar renders exactly one button per route handed to
 * it by the navigator -- no more, no fewer -- and that pressing an
 * unfocused tab navigates to it.
 */
function buildProps(routeNames: string[], focusedIndex: number, hidden: string[] = []) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));

  const routes = routeNames.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        // Mirrors what Expo Router actually produces for `href: null` —
        // the route stays in `state.routes`, it just gets a null button and
        // a display:none item style. See TabsClient's `href` shortcut.
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
      state: { routes, index: focusedIndex } as any,
      descriptors: descriptors as any,
      navigation: { navigate, emit } as any,
      insets: { top: 0, bottom: 0, left: 0, right: 0 } as any,
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
          <GlassTabBar {...props} />
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });
  return tree!;
}

describe('GlassTabBar', () => {
  it('renders exactly one button per route it is given, never more', () => {
    const { props } = buildProps(['home', 'health', 'donate', 'community', 'calendar', 'profile'], 0);
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    expect(buttons).toHaveLength(6);
  });

  it('renders exactly one button for a 3-route navigator (courier tabs)', () => {
    const { props } = buildProps(['active', 'history', 'profile'], 0);
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    expect(buttons).toHaveLength(3);
  });

  it('navigates to an unfocused tab on press', () => {
    const { props, navigate, emit } = buildProps(['home', 'health'], 0);
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    act(() => {
      buttons[1]!.props.onPress();
    });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'health-key' }));
    expect(navigate).toHaveBeenCalledWith('health');
  });

  it('does not navigate when pressing the already-focused tab', () => {
    const { props, navigate } = buildProps(['home', 'health'], 0);
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    act(() => {
      buttons[0]!.props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * The real donor navigator registers ~19 routes and marks 13 of them
   * `href: null`. Those still arrive in `state.routes`, because `href: null`
   * is implemented as options React Navigation's *default* bar honors. A
   * custom bar that iterates `state.routes` blindly lays out a flex cell for
   * every one of them, so the six real icons get squeezed into the left edge
   * with 13 blank cells trailing off to the right -- which is exactly how
   * this shipped.
   */
  it('renders no button for routes hidden with href: null', () => {
    const { props } = buildProps(
      ['home', 'health', 'donate', 'community', 'calendar', 'profile', 'notifications', 'privacy', 'security'],
      0,
      ['notifications', 'privacy', 'security'],
    );
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    expect(buttons).toHaveLength(6);
  });

  it('keeps the focus highlight on the right tab when hidden routes precede it', () => {
    // 'hidden-a' sits at index 1, so the focused route 'donate' is at index 3
    // of the full list but index 2 of the visible list. Comparing array
    // indices instead of route keys would light up the wrong icon.
    const { props } = buildProps(
      ['home', 'hidden-a', 'health', 'donate'],
      3,
      ['hidden-a'],
    );
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    expect(buttons).toHaveLength(3);
    expect(buttons[2]!.props.accessibilityState).toEqual({ selected: true });
    expect(buttons[0]!.props.accessibilityState).toEqual({});
  });

  it('navigates correctly when hidden routes shift the visible indices', () => {
    const { props, navigate } = buildProps(
      ['home', 'hidden-a', 'health', 'donate'],
      0,
      ['hidden-a'],
    );
    const tree = renderBar(props);
    const buttons = tree.root.findAll((node) => node.type === Pressable);
    act(() => {
      buttons[1]!.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('health');
  });
});
