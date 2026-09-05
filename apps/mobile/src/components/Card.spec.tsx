import React from 'react';
import renderer, { type ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Card } from './Card';
import { GlassCard } from './GlassCard';
import { ThemeProvider, colors as darkColors, glassBlurOnCards } from '../theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

/**
 * A card is a translucent surface: a fill you can see the backdrop through, a
 * hairline border, and (on the upper tiers) a specular sheen. It shipped once
 * as a flat opaque box, which collapsed the whole design language, so what a
 * card *is* stays pinned here.
 *
 * What it is no longer is a `BlurView`. A backdrop blur that cannot sample its
 * backdrop does not degrade to "no blur" -- the platform draws a flat tinted
 * plate instead, and a screen tiled with them dims the entire app. That was
 * reported repeatedly, so cards render their surface directly and the effect
 * is behind `glassBlurOnCards`. The look survives because it never rested on
 * the blur: it rests on these values.
 */
function render(element: React.ReactElement) {
  return renderer.create(<ThemeProvider>{element}</ThemeProvider>);
}

/** [shadow wrapper, surface] -- the two views a card is built from. */
function layers(style?: ViewStyle) {
  const tree = render(<GlassCard style={style} />);
  const outer = tree.toJSON() as ReactTestRendererJSON;
  const surface = outer.children![0] as ReactTestRendererJSON;
  return {
    outer: StyleSheet.flatten(outer.props.style) as ViewStyle,
    surface: StyleSheet.flatten(surface.props.style) as ViewStyle,
  };
}

describe('a card is a translucent surface', () => {
  it('fills with a see-through tint, not an opaque color', () => {
    const { surface } = layers();

    expect(surface.backgroundColor).toBe(darkColors.glass.standard.fill);
    // The whole point: the backdrop shows through.
    expect(String(surface.backgroundColor)).toMatch(/rgba\(.*0\.\d+\)/);
  });

  it('carries a hairline border', () => {
    const { surface } = layers();

    expect(surface.borderWidth).toBe(1);
    expect(surface.borderColor).toBe(darkColors.glass.standard.border);
  });

  it('renders the content it was given', () => {
    const tree = render(
      <Card>
        <Text>inside</Text>
      </Card>,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('inside');
  });

  it('does not mount a blur per card while the effect is off', () => {
    // Guards the decision itself: flipping `glassBlurOnCards` back on is a
    // deliberate act, not something that creeps back in.
    const tree = render(<Card />);
    const blurs = tree.root.findAllByType(BlurView);

    expect(blurs).toHaveLength(glassBlurOnCards ? 1 : 0);
  });
});

/**
 * A style handed in at the call site is split between the two views by what
 * each property means. When it landed whole on the inner one, `marginTop: 32`
 * inset the *content* inside a full-size panel, and the card drew as a large
 * faint rectangle with a smaller one floating inside it -- on all 21 cards in
 * the app that pass a margin.
 */
describe('which layer a call-site style lands on', () => {
  it('puts margins on the outer wrapper, so the whole card moves', () => {
    const { outer, surface } = layers({ marginTop: 32, marginBottom: 24 });

    expect(outer.marginTop).toBe(32);
    expect(outer.marginBottom).toBe(24);
    expect(surface.marginTop).toBeUndefined();
  });

  it('puts sizing and flex on the outer wrapper', () => {
    const { outer, surface } = layers({ flex: 1, alignSelf: 'center', maxWidth: 320 });

    expect(outer.flex).toBe(1);
    expect(outer.alignSelf).toBe('center');
    expect(outer.maxWidth).toBe(320);
    expect(surface.flex).toBeUndefined();
  });

  it('keeps padding, borders and content layout on the surface', () => {
    const { outer, surface } = layers({
      padding: 14,
      borderColor: 'rgba(216, 83, 96, 0.35)',
      alignItems: 'center',
    });

    expect(surface.padding).toBe(14);
    expect(surface.borderColor).toBe('rgba(216, 83, 96, 0.35)');
    expect(surface.alignItems).toBe('center');
    expect(outer.padding).toBeUndefined();
  });

  it('applies an overridden corner to both layers', () => {
    const { outer, surface } = layers({ borderRadius: 8 });

    expect(outer.borderRadius).toBe(8);
    expect(surface.borderRadius).toBe(8);
  });
});
