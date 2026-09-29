import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The two Phase 4/5 rules that only a source scan can hold.
 *
 * Both were accepted as product decisions and neither is visible in a
 * screenshot, a type, or a rendered test: a violet badge looks deliberate, and
 * a screen with six cards looks like a screen with six cards. What made V2 flat
 * was the aggregate, and the aggregate is what these check.
 */

const ROOT = join(__dirname, '..', '..');

function screenFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) screenFiles(path, found);
    else if (entry.endsWith('.tsx') && !entry.includes('.spec.')) found.push(path);
  }
  return found;
}

const SCREENS = screenFiles(join(ROOT, 'app')).map((path) => ({
  name: relative(ROOT, path),
  source: readFileSync(path, 'utf8'),
}));

describe('violet means the AI spoke, and nothing else', () => {
  /**
   * The two places a model's output is actually shown. Adding a file here is a
   * product decision about what counts as AI, not a way to quiet the test --
   * which is why the list is short enough to read.
   */
  const AI_SCREENS = ['app/(app)/insights/index.tsx', 'app/(app)/health.tsx'];

  /**
   * Every spelling of the accent, because the first version of this test only
   * matched the JSX prop and passed -- while seven object-literal uses sat in
   * taxonomy maps on four screens, which is where the abuse actually lives.
   * A guard that only catches the form you were already thinking about is a
   * guard that tells you what you already believed.
   */
  const VIOLET = [
    /tone=["']insight["']/, //            <Badge tone="insight" />
    /tone=\{'insight'(?: as const)?\}/, // <Stat tone={'insight'} />
    /tone: 'insight'/, //                 { icon: Gauge, tone: 'insight' }
    /colors\.insight\./, //               colors.insight.base
  ];

  const offenders = SCREENS.filter(
    ({ name, source }) =>
      !AI_SCREENS.includes(name.split('\\').join('/')) && VIOLET.some((re) => re.test(source)),
  );

  it('is not spent on XP, badge counts, reading rewards or challenge types', () => {
    // V2 drew all four in `insight`. A palette where the AI colour also means
    // "you earned points" cannot be used to say the AI said something.
    expect(offenders.map((o) => o.name)).toEqual([]);
  });
});

describe('a Surface has to mean something', () => {
  /**
   * The cap is what a screen can hold while each raised box still
   * distinguishes its contents from the page: a distinct object, a single
   * tappable entity, or something genuinely floating.
   *
   * A `level="flat"` surface is a grouping device -- a row on the page, a
   * block that belongs to the page -- and is not a card, so it is not counted.
   * Loading skeletons are never on screen at the same time as the cards they
   * stand in for, but they are counted anyway: the cap is a reading of the
   * source, and a source that draws six boxes is a source someone will copy.
   */
  const CAP = 4;

  const raised = (source: string) =>
    (source.match(/<Surface(?:\s[^>]*)?>/gs) ?? []).filter((tag) => !/level=["']flat["']/.test(tag)).length;

  it.each(SCREENS.map(({ name, source }) => [name, raised(source)]))('%s draws %i', (_name, count) => {
    expect(count).toBeLessThanOrEqual(CAP);
  });
});
