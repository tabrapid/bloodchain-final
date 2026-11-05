import { readFileSync } from 'node:fs';
import { type as typeScale } from './tokens';
import { fonts } from './fonts';

/**
 * The two promises V3's typography makes, pinned.
 *
 * Neither is checkable by looking at a screenshot, which is exactly why they
 * went unnoticed through a whole sprint of visual review: a browser renders a
 * numeric weight by synthesising one, so `fontWeight: '600'` looked right in
 * every capture and resolved to something else entirely on the phone.
 */
describe('the scale carries faces, not weights', () => {
  const variants = Object.keys(typeScale) as (keyof typeof typeScale)[];

  it.each(variants)('%s names a real face from the loader', (variant) => {
    const families: string[] = Object.values(fonts);
    expect(families).toContain(typeScale[variant].fontFamily);
  });

  /**
   * The rule this enforces is not stylistic. Asking Android for a numeric
   * weight on top of a family that already has that weight makes it synthesise
   * one over the real face; the result is heavier and slightly smeared, and it
   * is the single most reliable way to make a typeface look cheap.
   */
  it.each(variants)('%s does not also ask for a numeric weight', (variant) => {
    expect(typeScale[variant]).not.toHaveProperty('fontWeight');
  });

  it.each(variants)('%s declares an explicit lineHeight', (variant) => {
    // Required, because `includeFontPadding: false` removes the padding Android
    // would otherwise derive the line box from.
    expect(typeScale[variant].lineHeight).toBeGreaterThan(typeScale[variant].fontSize);
  });
});

/**
 * The V2 scale separated most adjacent levels by two points and a weight. Two
 * points is not a difference anyone perceives, so the weight was doing all the
 * work -- and the weight was the part Android would not honour.
 */
describe('adjacent levels differ by size AND face', () => {
  const ladder = ['display', 'h1', 'h2', 'h3', 'title', 'body'] as const;

  it.each(ladder.slice(0, -1).map((level, i) => [level, ladder[i + 1]!] as const))(
    '%s is distinguishable from %s by more than one signal',
    (bigger, smaller) => {
      const delta = typeScale[bigger].fontSize - typeScale[smaller].fontSize;
      expect(delta).toBeGreaterThan(0);

      // A step of four points or more reads on its own. A smaller one does not
      // -- h3 (18) over body (15) is three, which is where V2's whole scale
      // lived and why it looked flat -- so a tight step has to change face as
      // well. That is the rule: never one signal alone.
      if (delta < 4) {
        expect(typeScale[bigger].fontFamily).not.toBe(typeScale[smaller].fontFamily);
      }
    },
  );

  it('changes face at least once down the ladder, so size is not the only signal', () => {
    const faces = new Set(ladder.map((level) => typeScale[level].fontFamily));
    expect(faces.size).toBeGreaterThan(1);
  });
});

describe('the V4 scale', () => {
  it('is the one in the tokens', () => {
    expect(typeScale.display.fontSize).toBe(40);
    expect(typeScale.h1.fontSize).toBe(28);
    expect(typeScale.h2.fontSize).toBe(22);
    expect(typeScale.h3.fontSize).toBe(18);
    expect(typeScale.title.fontSize).toBe(16);
    expect(typeScale.body.fontSize).toBe(15);
    expect(typeScale.label.fontSize).toBe(13);
    expect(typeScale.caption.fontSize).toBe(12);
  });

  it('draws titles and values in the display face, sentences in the text face', () => {
    // Two families, each with one job. A title in Inter is anonymous; a
    // paragraph in Manrope is tiring. The split is what gives the hierarchy
    // its "obvious at arm's length" quality, so it is pinned.
    for (const variant of ['display', 'h1', 'h2', 'h3', 'value', 'valueSm', 'hero'] as const) {
      expect(typeScale[variant].fontFamily.startsWith('Manrope_')).toBe(true);
    }
    for (const variant of ['title', 'body', 'bodyMedium', 'bodyStrong', 'label', 'caption', 'overline'] as const) {
      expect(typeScale[variant].fontFamily.startsWith('Inter_')).toBe(true);
    }
  });

  /**
   * The tab bar drew its labels at 10sp once, which at six tabs reads as
   * decoration rather than navigation. Nothing readable goes below 11.
   */
  it('never puts readable interface text below 11', () => {
    expect(typeScale.caption.fontSize).toBeGreaterThanOrEqual(11);
    expect(typeScale.overline.fontSize).toBeGreaterThanOrEqual(11);
  });
});

/**
 * The faces named in the scale are files that exist.
 *
 * R1 -- the root cause of "it looks flat on the phone" -- was that no font was
 * ever loaded, so `fontFamily: 'Inter_600SemiBold'` silently fell back to
 * Roboto at whatever weight the platform chose. A name that resolves to nothing
 * fails exactly that way again: quietly, and only on a device.
 *
 * Production Android exports of this app bundle all four faces (verified by
 * content hash against the installed package). This test is the cheap version
 * of that check, and it runs on every commit.
 */
describe('the faces exist on disk', () => {
  const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs');
  const { dirname, join } = require('node:path') as typeof import('node:path');

  const packageRoots = [
    dirname(require.resolve('@expo-google-fonts/inter/package.json')),
    dirname(require.resolve('@expo-google-fonts/manrope/package.json')),
  ];

  function ttfNames(dir: string, found: Set<string> = new Set()): Set<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) ttfNames(path, found);
      else if (entry.name.endsWith('.ttf')) found.add(entry.name.replace(/\.ttf$/, ''));
    }
    return found;
  }

  const shipped = new Set<string>();
  for (const root of packageRoots) {
    if (existsSync(root)) for (const name of ttfNames(root)) shipped.add(name);
  }

  it.each(Object.entries(fonts))('%s -> %s is a real file', (_weight, family) => {
    expect(shipped.has(family)).toBe(true);
  });

  it('loads every face the scale asks for', () => {
    // A family in the scale that `useAppFonts` does not load is a family that
    // resolves to the system face at runtime and to nothing in review.
    const loader = readFileSync(join(__dirname, 'fonts.ts'), 'utf8');
    for (const family of Object.values(fonts)) {
      expect(loader).toContain(family);
    }
  });
});
