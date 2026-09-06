import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..', 'app', '(app)');
const LAYOUT = join(APP_DIR, '_layout.tsx');

/** Every `name="..."` a `Tabs.Screen` in the donor layout declares. */
function declaredRouteNames(): string[] {
  const source = readFileSync(LAYOUT, 'utf8');
  const names: string[] = [];
  const pattern = /<Tabs\.Screen[^>]*?\bname="([^"]+)"/gs;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

/**
 * A `Tabs.Screen` naming a route that does not exist is not an error -- the
 * navigator logs a warning and carries on without it. That is how the
 * Community tab went missing from the bar: the layout asked for "community",
 * the router had registered `community/index.tsx` as "community/index", and
 * the tab silently never rendered while the real route sat alongside it
 * hidden behind `href: null`.
 *
 * The route name is the file path minus the extension, so the check is just
 * that the file each declared name points at is on disk.
 */
describe('the donor tab layout', () => {
  it('declares only routes that exist on disk', () => {
    const missing = declaredRouteNames().filter(
      (name) => !existsSync(join(APP_DIR, `${name}.tsx`)),
    );

    expect(missing).toEqual([]);
  });

  it('declares each route exactly once', () => {
    const names = declaredRouteNames();
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

    expect(duplicates).toEqual([]);
  });

  /** The six the bar is meant to show, in the order it shows them. */
  it('keeps all six donor tabs visible', () => {
    const source = readFileSync(LAYOUT, 'utf8');
    const visible = declaredRouteNames().filter((name) => {
      const declaration = source.slice(source.indexOf(`name="${name}"`));
      return !declaration.slice(0, 200).includes('href: null');
    });

    expect(visible).toEqual([
      'home',
      'health',
      'donate',
      'community/index',
      'calendar',
      'profile',
    ]);
  });
});
