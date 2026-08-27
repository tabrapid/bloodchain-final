import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * P3-14 guard.
 *
 * A controller that declares its request body as an inline anonymous type —
 * `@Body() dto: { courierId: string }` — silently opts that route out of every
 * validation the app configures. NestJS's ValidationPipe skips validation when
 * the resolved metatype is a native type, and an inline object type compiles to
 * `Object`, which is on that skip list. The route then runs with no
 * `whitelist`, no `forbidNonWhitelisted`, no `transform`, and no request body
 * in the OpenAPI document — while still type-checking and linting cleanly.
 *
 * Neither TypeScript nor ESLint can see this, which is how five routes ended up
 * this way (P3-7 fixed one, P3-14 the other four). So the check has to live
 * here, in a test that reads the controllers as source.
 */
describe('P3-14: no controller declares an inline @Body() object type', () => {
  const modulesDir = join(__dirname, '..', 'modules');

  function controllerFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return controllerFiles(full);
      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : [];
    });
  }

  const files = controllerFiles(modulesDir);

  it('finds the controllers to check (guards against a silently empty scan)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.slice(modulesDir.length + 1), f]))(
    '%s binds every @Body() to a DTO class',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');

      // `@Body()` (or `@Body('field')`) followed by a parameter whose type
      // annotation opens a `{` — an inline object type — rather than naming a
      // class. Tolerates a line break between the decorator and the parameter.
      const inlineBody = /@Body\([^)]*\)\s*\w+\s*(\?)?\s*:\s*\{/g;
      const offenders = source.match(inlineBody) ?? [];

      expect(offenders).toEqual([]);
    },
  );
});
