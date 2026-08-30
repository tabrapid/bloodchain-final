import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Card } from './Card';
import { GlassCard } from './GlassCard';
import { ThemeProvider } from '../theme';

/**
 * Regression tests for the Liquid Glass redesign shipping as flat opaque
 * cards on a real device.
 *
 * Two independent bugs caused that, both invisible to typecheck and to every
 * other test:
 *
 * 1. `Card` was still the old flat opaque surface, and ~29 of the app's
 *    screens are built on `Card` rather than `GlassCard` -- so the redesign
 *    only ever reached the handful of screens that named `GlassCard`
 *    explicitly. Confirmed live from a screenshot: the Donate screen, which
 *    is all `Card`, rendered as solid boxes.
 * 2. Blur was gated behind `Platform.OS === 'ios'`, so on Android -- the
 *    platform the app was actually being tested on -- there was no blur at
 *    all, only a translucent fill over a near-flat background.
 *
 * These assert the fix at the level that actually broke: that the shared
 * card component really does mount a BlurView, on every platform.
 */
function render(node: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree!;
}

describe('Card / GlassCard render a real glass surface', () => {
  it('Card mounts a BlurView (it is the glass surface, not a flat box)', () => {
    const tree = render(
      <Card>
        <Text>content</Text>
      </Card>,
    );
    expect(tree.root.findAllByType(BlurView).length).toBeGreaterThan(0);
  });

  it('GlassCard mounts a BlurView', () => {
    const tree = render(
      <GlassCard>
        <Text>content</Text>
      </GlassCard>,
    );
    expect(tree.root.findAllByType(BlurView).length).toBeGreaterThan(0);
  });

  it('enables the Android blur method, so blur is not iOS-only', () => {
    const tree = render(
      <Card>
        <Text>content</Text>
      </Card>,
    );
    const blur = tree.root.findAllByType(BlurView)[0]!;
    expect(blur.props.experimentalBlurMethod).toBe('dimezisBlurView');
  });

  it('still renders the content it was given', () => {
    const tree = render(
      <Card>
        <Text>hello</Text>
      </Card>,
    );
    const texts = tree.root.findAllByType(Text);
    expect(texts.some((t) => t.props.children === 'hello')).toBe(true);
  });
});
