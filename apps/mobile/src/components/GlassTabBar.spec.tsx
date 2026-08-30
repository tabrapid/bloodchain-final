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
function buildProps(routeNames: string[], focusedIndex: number) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));

  const routes = routeNames.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        options: {
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
});
