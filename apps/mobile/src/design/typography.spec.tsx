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

  it.each(variants)('%s names a real Inter face', (variant) => {
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
  const ladder = ['display', 'h1', 'h2', 'h3', 'body'] as const;

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

describe('the scale the Product Owner specified', () => {
  it('is the one in the tokens', () => {
    expect(typeScale.display.fontSize).toBe(40);
    expect(typeScale.h1.fontSize).toBe(30);
    expect(typeScale.h2.fontSize).toBe(22);
    expect(typeScale.h3.fontSize).toBe(18);
    expect(typeScale.body.fontSize).toBe(15);
    expect(typeScale.label.fontSize).toBe(13);
    expect(typeScale.caption.fontSize).toBe(11);
  });

  /**
   * Phase 10: the tab bar drew its labels at 10sp, which at six tabs reads as
   * decoration rather than navigation. `caption` is what it uses, so the floor
   * is enforced here.
   */
  it('never puts readable interface text below 11', () => {
    expect(typeScale.caption.fontSize).toBeGreaterThanOrEqual(11);
    expect(typeScale.overline.fontSize).toBeGreaterThanOrEqual(11);
  });
});
