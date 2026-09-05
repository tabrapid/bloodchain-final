import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
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

/**
 * A card is three stacked views: a shadow wrapper, the blur, and the bordered
 * content box. A style handed in at the call site has to be split between them
 * by what each property means -- margins position the whole card, padding
 * describes its interior.
 *
 * Getting this wrong is not subtle. When the call-site style landed whole on
 * the innermost box, `marginTop: 32` inset the *content* 32px inside a
 * full-size blur panel, so the card rendered as a large faint rectangle with a
 * smaller bordered card floating inside it. Twenty-one cards across the app
 * pass a margin, so twenty-one of them drew that way.
 */
describe('GlassCard: which layer a call-site style lands on', () => {
  const Glass = GlassCard;

  function layers(style: object) {
    const tree = renderer.create(
      <ThemeProvider>
        <Glass style={style} />
      </ThemeProvider>,
    );
    const outer = tree.toJSON() as ReactTestRendererJSON;
    const blur = outer.children![0] as ReactTestRendererJSON;
    const content = blur.children![0] as ReactTestRendererJSON;
    return {
      outer: StyleSheet.flatten(outer.props.style),
      content: StyleSheet.flatten(content.props.style),
    };
  }

  it('puts margins on the outer wrapper, so the whole card moves', () => {
    const { outer, content } = layers({ marginTop: 32, marginBottom: 24 });

    expect(outer.marginTop).toBe(32);
    expect(outer.marginBottom).toBe(24);
    expect(content.marginTop).toBeUndefined();
    expect(content.marginBottom).toBeUndefined();
  });

  it('puts sizing and flex on the outer wrapper', () => {
    const { outer, content } = layers({ flex: 1, alignSelf: 'center', maxWidth: 320 });

    expect(outer.flex).toBe(1);
    expect(outer.alignSelf).toBe('center');
    expect(outer.maxWidth).toBe(320);
    expect(content.flex).toBeUndefined();
  });

  it('keeps padding, borders and content layout on the inner box', () => {
    const { outer, content } = layers({
      padding: 14,
      borderColor: 'rgba(216, 83, 96, 0.35)',
      alignItems: 'center',
    });

    expect(content.padding).toBe(14);
    expect(content.borderColor).toBe('rgba(216, 83, 96, 0.35)');
    expect(content.alignItems).toBe('center');
    expect(outer.padding).toBeUndefined();
  });

  it('applies an overridden corner to every layer, so the blur clips to it', () => {
    const tree = renderer.create(
      <ThemeProvider>
        <Glass style={{ borderRadius: 8 }} />
      </ThemeProvider>,
    );
    const outer = tree.toJSON() as ReactTestRendererJSON;
    const blur = outer.children![0] as ReactTestRendererJSON;
    const content = blur.children![0] as ReactTestRendererJSON;

    expect(StyleSheet.flatten(outer.props.style).borderRadius).toBe(8);
    expect(StyleSheet.flatten(blur.props.style).borderRadius).toBe(8);
    expect(StyleSheet.flatten(content.props.style).borderRadius).toBe(8);
  });
});
