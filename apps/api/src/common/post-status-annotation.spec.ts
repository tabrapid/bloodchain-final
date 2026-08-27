import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * P3-12 guard.
 *
 * NestJS answers POST with 201 unless the handler carries
 * `@HttpCode(HttpStatus.OK)`. P3-12 reconciled 16 routes whose real status
 * disagreed with their `@ApiResponse` annotation — by hand, route by route,
 * because the right answer differs per route (a POST that creates a row should
 * say 201; one that updates an existing row should say 200).
 *
 * Doing that by hand missed one: `POST /education/:id/complete` got the
 * `@HttpCode(HttpStatus.OK)` but kept `@ApiResponse({ status: 201 })`, so its
 * OpenAPI document lied about the very thing P3-12 set out to fix. A new e2e
 * test caught it. This spec makes the class of mistake impossible to
 * reintroduce silently: it reads the controllers and requires each POST's
 * documented success status to match the status the route will actually
 * return.
 */
describe('P3-12: every POST documents the status code it actually returns', () => {
  const modulesDir = join(__dirname, '..', 'modules');

  function controllerFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return controllerFiles(full);
      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : [];
    });
  }

  const mismatches: string[] = [];
  let postsChecked = 0;

  for (const file of controllerFiles(modulesDir)) {
    const source = readFileSync(file, 'utf8');

    // Each @Post decorator through to the start of its handler body.
    for (const match of source.matchAll(/@Post\([^)]*\)(.*?)\n {2}[a-zA-Z_]/gs)) {
      const block = match[1] ?? '';
      if (block.includes('@Post(')) continue;

      const documented = [...block.matchAll(/@ApiResponse\(\{\s*status:\s*(\d+)/g)]
        .map((m) => m[1])
        .filter((status) => status === '200' || status === '201');

      // A route that documents no success status has nothing to contradict.
      if (documented.length === 0) continue;

      postsChecked += 1;
      const actual = block.includes('@HttpCode(HttpStatus.OK)') ? '200' : '201';

      if (!documented.includes(actual)) {
        const line = source.slice(0, match.index).split('\n').length;
        mismatches.push(
          `${file.slice(modulesDir.length + 1)}:${line} returns ${actual}, documents ${documented.join('/')}`,
        );
      }
    }
  }

  it('checks a realistic number of POST routes', () => {
    expect(postsChecked).toBeGreaterThan(20);
  });

  it('finds no route whose documented status contradicts its real one', () => {
    expect(mismatches).toEqual([]);
  });
});
