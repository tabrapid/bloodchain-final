import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
 * Every route Expo Router derives from the file tree, which is the path
 * relative to the group folder with the extension removed -- so
 * `community/index.tsx` registers as "community/index", not "community".
 */
function routeNamesOnDisk(): string[] {
  const names: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx') {
        names.push(`${prefix}${entry.name.replace(/\.tsx$/, '')}`);
      }
    }
  };
  walk(APP_DIR, '');
  return names.sort();
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
  /**
   * The other direction, and the one that was missing.
   *
   * The existing checks catch a declaration pointing at no route. Nothing
   * caught a route with no declaration -- and that is the commoner mistake,
   * because adding a screen is a thing you do without opening the layout. The
   * navigator then registers the route, finds no `href: null` for it, and logs
   * "No route named ... exists in nested children" on every load, once per
   * missing declaration. `notification-settings` had been in that state.
   */
  it('declares every route that exists on disk', () => {
    const declared = new Set(declaredRouteNames());
    const onDisk = routeNamesOnDisk();

    expect(onDisk.filter((name) => !declared.has(name))).toEqual([]);
  });
});
