import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 2.1 guard.
 *
 * The global `ValidationPipe` runs with `enableImplicitConversion`, which
 * coerces every property to its declared type. For a boolean that coercion is
 * `Boolean(value)`, under which every non-empty string is `true` -- so a bare
 *
 *   @IsOptional() @IsBoolean() maintenanceMode?: boolean;
 *
 * accepts `"false"` and stores `true`. Validation cannot catch it, because by
 * the time `@IsBoolean()` runs the value really is a boolean. The request
 * succeeds and the answer looks plausible while meaning the opposite.
 *
 * `OptionalBooleanField` / `RequiredBooleanField` read the raw value from
 * behind the implicit conversion and accept only `true` and `false`. This test
 * is what stops the next boolean field from being written the old way: neither
 * TypeScript nor ESLint can see the difference, and the symptom on a live
 * system is a filter or a setting that quietly means its own opposite.
 */
describe('every boolean on a request DTO is parsed strictly', () => {
  const srcDir = join(__dirname, '..');

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
      return entry.name.endsWith('.spec.ts') ? [] : [full];
    });
  }

  const files = sourceFiles(srcDir);

  /**
   * Which classes a request actually reaches: named directly in a `@Query()` or
   * `@Body()` parameter, extended from one that is, or nested inside one
   * through `@Type(() => X)`. A DTO the pipe never sees needs no decorator, and
   * response shapes are not validated at all.
   */
  const declaredIn = new Map<string, string>();
  const extendsOf = new Map<string, string>();
  const nestedIn = new Map<string, Set<string>>();
  const boundToRequest = new Set<string>();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/export (?:abstract )?class (\w+)(?:\s+extends\s+(\w+))?/g)) {
      declaredIn.set(match[1]!, file);
      if (match[2]) extendsOf.set(match[1]!, match[2]);
    }
    // `@Type(() => X)` inside a class file means X is reachable from it.
    const owner = /export (?:abstract )?class (\w+)/.exec(source)?.[1];
    if (owner) {
      for (const match of source.matchAll(/@Type\(\(\)\s*=>\s*(\w+)\)/g)) {
        const set = nestedIn.get(match[1]!) ?? new Set<string>();
        set.add(owner);
        nestedIn.set(match[1]!, set);
      }
    }
    if (file.endsWith('.controller.ts')) {
      for (const match of source.matchAll(/@(?:Query|Body)\(\s*\)\s*\w+:\s*(\w+)/g)) {
        boundToRequest.add(match[1]!);
      }
    }
  }

  function isReachable(name: string, seen = new Set<string>()): boolean {
    if (seen.has(name)) return false;
    seen.add(name);
    if (boundToRequest.has(name)) return true;
    for (const [child, parent] of extendsOf) {
      if (parent === name && isReachable(child, seen)) return true;
    }
    for (const parent of nestedIn.get(name) ?? []) {
      if (isReachable(parent, seen)) return true;
    }
    return false;
  }

  interface Field {
    file: string;
    line: number;
    dto: string;
    property: string;
    strict: boolean;
  }

  /** Every boolean property on a class, with the decorators above it. */
  function booleanFields(file: string): Field[] {
    const lines = readFileSync(file, 'utf8').split('\n');
    const found: Field[] = [];
    let dto: string | null = null;
    let decorators: string[] = [];

    lines.forEach((line, index) => {
      const opened = /^\s*export (?:abstract )?class (\w+)/.exec(line);
      if (opened) {
        dto = opened[1]!;
        decorators = [];
        return;
      }
      // An interface, type alias or function ends the class body we were in;
      // response interfaces carry booleans that nothing validates.
      if (/^\s*export (interface|type|const|function|enum)\b/.test(line)) {
        dto = null;
        decorators = [];
        return;
      }
      if (/^\s*@\w+/.test(line)) {
        decorators.push(line.trim());
        return;
      }
      const property = /^\s*(\w+)[?!]?:\s*boolean\s*;/.exec(line);
      if (property && dto) {
        found.push({
          file,
          line: index + 1,
          dto,
          property: property[1]!,
          strict: decorators.some((d) => d.includes('BooleanField')),
        });
      }
      if (line.trim()) decorators = [];
    });
    return found;
  }

  const fields = files
    .flatMap(booleanFields)
    .filter((field) => isReachable(field.dto));

  it('finds the boolean request fields to check (guards against a silently empty scan)', () => {
    expect(fields.length).toBeGreaterThan(20);
    // The two the sprint singled out, so a scan that silently stopped matching
    // property syntax fails here rather than passing with nothing to say.
    expect(fields.map((f) => f.property)).toEqual(
      expect.arrayContaining(['maintenanceMode', 'consentLocation']),
    );
  });

  it('parses every one of them strictly', () => {
    const loose = fields
      .filter((field) => !field.strict)
      .map(
        (field) =>
          `${field.file.slice(srcDir.length + 1)}:${field.line} ${field.dto}.${field.property}`,
      );

    expect(loose).toEqual([]);
  });
});
