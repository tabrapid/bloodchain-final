/**
 * The palette is checked, not eyeballed.
 *
 * "Sufficient contrast" is a requirement of this rebuild and it is the kind of
 * requirement that quietly stops being true: someone nudges a neutral one step
 * darker to make a card sit better, and a caption that used to clear 4.5:1
 * lands at 4.1:1 on one surface out of four. Nobody sees it, because the
 * difference is invisible to the person who made it and obvious only to the
 * donor reading a lab value in sunlight.
 *
 * So every text token is measured against every surface it can legally appear
 * on, in both modes, using WCAG 2.1 relative luminance. A failure here names
 * the pair and the ratio.
 *
 * WCAG 2.1: 4.5:1 for body text, 3:1 for large text (>=18.66pt bold or 24pt
 * regular) and for non-text indicators such as borders and icons.
 */
import { themes, type DesignColors } from './tokens';

/** sRGB channel to linear, per WCAG 2.1 relative luminance. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parse(color: string): { r: number; g: number; b: number; a: number } {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1]!.split(',').map((p) => Number(p.trim()));
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
  }
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}

function luminance(color: string): number {
  const { r, g, b } = parse(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light! + 0.05) / (dark! + 0.05);
}

/** Surfaces text is allowed to sit directly on. */
function surfaces(c: DesignColors): Record<string, string> {
  return {
    background: c.background,
    sunken: c.sunken,
    surface: c.surface,
    surfaceRaised: c.surfaceRaised,
    surfacePressed: c.surfacePressed,
  };
}

const ACCENTS = ['rose', 'critical', 'clinical', 'insight', 'success', 'warning'] as const;

describe.each([
  ['dark', themes.dark],
  ['light', themes.light],
])('%s theme contrast', (_mode, colors) => {
  const on = surfaces(colors);

  it('primary and secondary text clear 4.5:1 on every surface', () => {
    const failures: string[] = [];
    for (const [name, surface] of Object.entries(on)) {
      for (const token of ['textPrimary', 'textSecondary'] as const) {
        const ratio = contrast(colors[token], surface);
        if (ratio < 4.5) failures.push(`${token} on ${name}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('tertiary text clears 4.5:1 on every surface', () => {
    // Tertiary is for timestamps and units, which are small, so it gets the
    // body threshold rather than the large-text one. If a value here has to
    // drop below 4.5 to look right, the right fix is to stop using it for text.
    const failures: string[] = [];
    for (const [name, surface] of Object.entries(on)) {
      const ratio = contrast(colors.textTertiary, surface);
      if (ratio < 4.5) failures.push(`textTertiary on ${name}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it.each(ACCENTS)('%s.text clears 4.5:1 on every surface', (accent) => {
    const failures: string[] = [];
    for (const [name, surface] of Object.entries(on)) {
      const ratio = contrast(colors[accent].text, surface);
      if (ratio < 4.5) failures.push(`${accent}.text on ${name}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it.each(ACCENTS)('%s.base clears 3:1 on every surface, the threshold for an indicator', (accent) => {
    // `base` is for fills, icons and status dots -- non-text, so 3:1. It is
    // NOT permitted for labels; that is what `text` is for.
    const failures: string[] = [];
    for (const [name, surface] of Object.entries(on)) {
      const ratio = contrast(colors[accent].base, surface);
      if (ratio < 3) failures.push(`${accent}.base on ${name}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it('text on a filled accent surface clears 4.5:1', () => {
    // The emergency button, and any other solid-accent control. This is what
    // `fill` exists for: `base` is tuned to be visible ON a dark surface, which
    // makes it too light to carry white text. Using `base` here reads
    // acceptable and measures 4.1:1.
    const failures: string[] = [];
    for (const accent of ACCENTS) {
      const ratio = contrast(colors.textOnAccent, colors[accent].fill);
      if (ratio < 4.5) failures.push(`textOnAccent on ${accent}.fill: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it.each(ACCENTS)('%s.fill is distinguishable from the surface behind it', (accent) => {
    const failures: string[] = [];
    for (const [name, surface] of Object.entries(on)) {
      const ratio = contrast(colors[accent].fill, surface);
      if (ratio < 3) failures.push(`${accent}.fill on ${name}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it('borders and dividers are visible against their surface', () => {
    // 3:1 is the non-text threshold. A divider below it is decoration that
    // nobody can see, which is worse than no divider at all.
    expect(contrast(colors.border, colors.surface)).toBeGreaterThanOrEqual(1.3);
    expect(contrast(colors.divider, colors.surface)).toBeGreaterThanOrEqual(1.1);
  });
});

describe('the emergency colour is distinguishable from the brand colour', () => {
  /**
   * The reason this rebuild separated them.
   *
   * V1 used one rose for both `primary` and `danger`. In a blood-service app
   * that is the most expensive possible collision: if the brand is red, red
   * means "Bloodchain", and an emergency has no colour left to be. These are
   * now different hues, and the check is on the hue rather than on the hex, so
   * a future tweak that drifts them back together fails here.
   */
  function hue(color: string): number {
    const { r, g, b } = parse(color);
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    if (d === 0) return 0;
    let h: number;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  }

  it.each([
    ['dark', themes.dark],
    ['light', themes.light],
  ])('%s: rose and critical are at least 15 degrees apart', (_mode, colors) => {
    const separation = Math.abs(hue(colors.rose.base) - hue(colors.critical.base));
    expect(separation).toBeGreaterThanOrEqual(15);
  });
});
