import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { Screen } from './Screen';
import { ThemeProvider } from '../theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

/**
 * `flex: 1` sets `flexBasis: 0`, which inside a scroll container resolves the
 * child's height against the viewport instead of its content. A screen whose
 * content ran longer than one screen was therefore clamped to one screen:
 * scrolling stopped early and everything past the fold was unreachable, with
 * the last card cut in half. It has to be `flexGrow`, which still fills the
 * viewport when content is short but lets it grow past when it is not.
 */
/**
 * React 19 no longer renders synchronously from `renderer.create`: the work is
 * scheduled, so `toJSON()` on the next line returns null unless the render is
 * flushed. `act()` is what flushes it. Under React 18 this helper happened to
 * work without one.
 */
function contentStyle(scroll: boolean): ViewStyle {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <Screen scroll={scroll}>
          <Text>content</Text>
        </Screen>
      </ThemeProvider>,
    );
  });

  // SafeAreaView > (ScrollView >) content wrapper
  let node = tree.toJSON() as ReactTestRendererJSON;
  while (node.children && typeof node.children[0] === 'object') {
    const child = node.children[0] as ReactTestRendererJSON;
    const style = StyleSheet.flatten(child.props?.style) as ViewStyle | undefined;
    if (style?.padding !== undefined) return style;
    node = child;
  }
  throw new Error('content wrapper not found');
}

describe('Screen content sizing', () => {
  it('lets scrolling content grow past the viewport', () => {
    const style = contentStyle(true);

    expect(style.flexGrow).toBe(1);
    // `flex` would re-introduce the clamp.
    expect(style.flex).toBeUndefined();
  });

  it('fills the frame when the screen does not scroll', () => {
    // A non-scrolling screen holds its own list, so it should fill exactly.
    expect(contentStyle(false).flex).toBe(1);
  });

  it('keeps content clear of the floating tab bar', () => {
    const style = contentStyle(true);

    // No tab bar in this tree, so the clearance is just the gutter -- what
    // matters is that the bottom is padded separately and can absorb the
    // bar's measured height.
    expect(style.paddingBottom).toBeGreaterThanOrEqual(style.padding as number);
  });
});
