import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * The backdrop -- the gradient and its color blooms -- is painted once at the
 * root by `AppBackground`, and every screen renders transparent on top of it.
 *
 * That only holds if the navigators are transparent too. Every React
 * Navigation scene paints `colors.background` from *React Navigation's own*
 * theme, which defaults to white and which this app never sets. While each
 * `Screen` painted its own opaque gradient that white was hidden; the moment
 * the screens went transparent it covered the backdrop on every screen in the
 * app, including login. A navigator that paints an opaque color of its own
 * does the same thing in a different shade.
 *
 * None of that shows up in a component test -- the navigators are only
 * configured in these files -- so the rule is checked where it is written.
 */
const APP_DIR = join(__dirname, '../../app');

function findLayouts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findLayouts(path);
    return entry.name === '_layout.tsx' ? [path] : [];
  });
}

const LAYOUTS = findLayouts(APP_DIR);

describe('navigator scene backgrounds', () => {
  it('finds every layout file', () => {
    // A rename that moves layouts elsewhere should fail loudly rather than
    // quietly checking nothing.
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(6);
  });

  it.each(LAYOUTS)('%s declares a transparent scene background', (layout: string) => {
    const src = readFileSync(layout, 'utf8');

    // The root Stack and each child Stack use `contentStyle`; the two Tabs
    // navigators use `sceneStyle`.
    const declaration = src.match(/(contentStyle|sceneStyle):\s*\{[^}]*\}/);
    expect(declaration).not.toBeNull();
    expect(declaration![0]).toContain("backgroundColor: 'transparent'");
  });

  it('leaves the backdrop as the only thing painting the app background', () => {
    const roots = LAYOUTS.map((layout) => readFileSync(layout, 'utf8')).join('\n');

    // `colors.background` on a navigator is the same bug wearing the app's own
    // palette: a flat fill covering the gradient and the blooms.
    expect(roots).not.toMatch(/(contentStyle|sceneStyle):\s*\{\s*backgroundColor:\s*colors\.background/);
  });
});
