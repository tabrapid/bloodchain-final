import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATALOGS, en } from './locales';
import { SUPPORTED_LOCALES } from './locale';
import { collectKeys, createTranslator, translate, type Catalog } from './translate';

/**
 * Source-level coverage: does the code only ask for keys that exist, and does
 * it stop asking for words directly?
 *
 * The catalogue's own tests compare the three languages against each other,
 * which cannot see a key a screen calls but nobody wrote -- that renders as the
 * raw key on the screen, in every language, and looks like a bug in the design
 * rather than in the catalogue. These tests read the app sources instead.
 *
 * They caught a real one: `t('appointment.notFound')` had been filed under
 * `status.appointment` because the writer matched the first `appointment: {` in
 * the file, and both the catalogue and the parity tests were perfectly happy.
 */
const ROOT = join(__dirname, '..', '..', '..');
const APP_DIRS = [
  'apps/mobile/app',
  'apps/mobile/src',
  'apps/hospital-web/app',
  'apps/hospital-web/components',
  'apps/hospital-web/lib',
  'apps/blood-center-web/app',
  'apps/blood-center-web/components',
  'apps/blood-center-web/lib',
  'apps/admin-web/app',
  'apps/admin-web/components',
  'apps/admin-web/lib',
  'packages/ui/src',
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) out.push(full);
    }
  };
  for (const dir of APP_DIRS) walk(join(ROOT, dir));
  return out;
}

const FILES = sourceFiles().map((path) => ({
  path: relative(ROOT, path),
  text: readFileSync(path, 'utf8'),
}));

/** `t('some.key')` -- the literal form, which can be checked exactly. */
const LITERAL_KEY = /(?<![\w.$])t\(\s*'([a-zA-Z][\w.]*)'/g;
/** `` t(`status.shipment.${x}`) `` -- only the fixed prefix can be checked. */
const TEMPLATE_PREFIX = /(?<![\w.$])t\(\s*`([a-zA-Z][\w.]*)\.\$\{/g;

function matches(pattern: RegExp, text: string): string[] {
  return [...text.matchAll(new RegExp(pattern))].map((m) => m[1]!);
}

describe('the code only asks for keys that exist', () => {
  const t = createTranslator(CATALOGS, 'en');

  it('scans a meaningful number of files, guarding against an empty walk', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('resolves every literal t(...) key in every app', () => {
    const unresolved: string[] = [];
    for (const { path, text } of FILES) {
      for (const key of matches(LITERAL_KEY, text)) {
        // A key that resolves to itself is one no catalogue has: it would be
        // rendered verbatim on the screen.
        if (t(key) === key) unresolved.push(`${path}: ${key}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('resolves the fixed prefix of every templated t(`ns.${value}`) key', () => {
    const missing: string[] = [];
    const namespaces = new Set(collectKeys(en).map((key) => key.slice(0, key.lastIndexOf('.'))));
    for (const { path, text } of FILES) {
      for (const prefix of matches(TEMPLATE_PREFIX, text)) {
        if (!namespaces.has(prefix)) missing.push(`${path}: ${prefix}.*`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('finds at least one templated status lookup, so the check is not vacuous', () => {
    const prefixes = FILES.flatMap(({ text }) => matches(TEMPLATE_PREFIX, text));
    expect(prefixes.filter((p) => p.startsWith('status.')).length).toBeGreaterThan(10);
  });
});

describe('status domains cover the enums they label', () => {
  const schema = readFileSync(join(ROOT, 'apps/api/prisma/schema.prisma'), 'utf8');

  function enumValues(name: string): string[] {
    const match = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
    if (!match) throw new Error(`enum ${name} not found in schema.prisma`);
    return match[1]!.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  // A status the catalogue has no word for renders as `status.shipment.FAILED`
  // on a row in a hospital console, so every value the database can produce
  // needs one.
  const DOMAINS: [string, string][] = [
    ['appointment', 'AppointmentStatus'],
    ['slot', 'SlotStatus'],
    ['donation', 'DonationStatus'],
    ['request', 'BloodRequestStatus'],
    ['shipment', 'ShipmentStatus'],
    ['shipmentEvent', 'ShipmentEventType'],
    ['unit', 'BloodUnitStatus'],
    ['emergency', 'EmergencyStatus'],
    ['organization', 'OrganizationStatus'],
    ['user', 'UserStatus'],
  ];

  it.each(DOMAINS)('status.%s covers every %s value', (domain, enumName) => {
    const covered = new Set(
      collectKeys(en)
        .filter((key) => key.startsWith(`status.${domain}.`))
        .map((key) => key.split('.')[2]),
    );
    const missing = enumValues(enumName).filter((value) => !covered.has(value));
    expect(missing).toEqual([]);
  });
});

describe('no covered screen still carries its own English', () => {
  /**
   * Every route file in the donor app, plus the components they render
   * through, plus every page of the three consoles.
   *
   * A prefix list rather than a file list: a screen added tomorrow is covered
   * the moment it exists, which is the opposite of the failure this guards
   * against — a new screen typed in English because nobody remembered to add
   * it to a list.
   */
  const COVERED = [
    'apps/mobile/app/',
    'apps/mobile/src/components/',
    'apps/hospital-web/app/',
    'apps/blood-center-web/app/',
    'apps/admin-web/app/',
    'packages/ui/src/components/',
  ];

  /**
   * Wording that is not copy even though it reads like it: a document title
   * rendered on the server before any locale is known, and the English
   * fallbacks the sidebar keeps beside its `labelKey`s.
   */
  const EXEMPT = [/\/layout\.tsx$/, /\/navigation\.tsx$/];

  const isCovered = (path: string) =>
    COVERED.some((prefix) => path.startsWith(prefix)) && !EXEMPT.some((re) => re.test(path));

  /** A quoted string that reads like a sentence a user would see. */
  function copyLiterals(text: string, options?: { templates?: boolean }): string[] {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^import[\s\S]*?from\s+'[^']*';$/gm, '')
      // Developer diagnostics are deliberately English: nobody reading the
      // screen ever sees them, and a translated stack trace helps no one.
      .replace(/console\.(error|warn|log|info|debug)\([^)]*\)/g, '');
    const found: string[] = [];

    // JSX text nodes, including ones that wrap across lines. The `>` must not
    // be the tail of `=>`, or every `() => Promise<T>` reads as the word
    // "Promise" sitting between two tags.
    for (const m of stripped.matchAll(/(?<![=-])>\s*([^<>{}][^<>{}]*?)\s*</gs)) {
      const candidate = m[1]!.replace(/\s+/g, ' ').trim();
      if (looksLikeCopy(candidate)) found.push(candidate);
    }
    // Copy-carrying props and attributes.
    for (const m of stripped.matchAll(
      /\b(label|title|subtitle|placeholder|message|description|header|note|text|name|aria-label|accessibilityLabel|accessibilityHint)\s*[=:]\s*'([^']{3,190})'/g,
    )) {
      if (looksLikeCopy(m[2]!)) found.push(m[2]!);
    }
    for (const m of stripped.matchAll(
      /\b(label|title|subtitle|placeholder|message|description|header|note|text|name|aria-label|accessibilityLabel|accessibilityHint)="([^"]{3,190})"/g,
    )) {
      if (looksLikeCopy(m[2]!)) found.push(m[2]!);
    }
    // Template literals: `${n} unread`, `At least ${n} characters`, `of
    // ${total} donors`. This is where hardcoded copy actually survived every
    // earlier sweep -- a quoted string is obvious in review, and a backtick
    // with a substitution in it reads as code.
    if (options?.templates) {
      for (const { literal, residue } of templateLiterals(stripped)) {
        if (looksLikeCopy(residue) && hasWord(residue)) found.push(literal);
      }
    }
    // `Alert.alert('Title', 'Body')` -- a modal is as user-facing as a screen.
    for (const m of stripped.matchAll(/Alert\.alert\(\s*'([^']{3,190})'\s*(?:,\s*'([^']{3,190})')?/g)) {
      for (const part of [m[1], m[2]]) {
        if (part && looksLikeCopy(part)) found.push(part);
      }
    }
    return found;
  }

  /**
   * Every template literal in the file, with its substitutions removed.
   *
   * Brace-matched rather than regex-matched: `${a ? `${b}` : c}` and
   * substitutions that wrap across lines both appear in this codebase, and a
   * non-greedy `[^}]*` leaves half the expression behind as "copy".
   *
   * A literal passed straight to `t(...)` is a catalogue key, not copy.
   */
  function templateLiterals(text: string): { literal: string; residue: string }[] {
    const out: { literal: string; residue: string }[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '`') continue;
      let literal = '';
      let residue = '';
      let j = i + 1;
      let closed = false;
      while (j < text.length) {
        const ch = text[j]!;
        if (ch === '\\') {
          literal += text.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (ch === '`') {
          closed = true;
          break;
        }
        if (ch === '$' && text[j + 1] === '{') {
          let depth = 1;
          let k = j + 2;
          while (k < text.length && depth > 0) {
            if (text[k] === '{') depth++;
            else if (text[k] === '}') depth--;
            k++;
          }
          literal += text.slice(j, k);
          residue += ' ';
          j = k;
          continue;
        }
        literal += ch;
        residue += ch;
        j++;
      }
      i = closed ? j : text.length;
      if (!closed || !literal.includes('\${')) continue;
      // `t(\`ns.${value}\`)` is a key being built, not a sentence.
      const before = text.slice(Math.max(0, i - literal.length - 6), i - literal.length - 1);
      if (/\bt\(\s*$/.test(before)) continue;
      out.push({ literal, residue: residue.replace(/\s+/g, ' ').trim() });
    }
    return out;
  }

  /**
   * A run of at least three letters.
   *
   * Two letters is a unit or a format marker -- `ml`, `hr` in a date pattern,
   * the `T` in an ISO timestamp -- and those are not copy. Three is where
   * words start: "left", "min", "unit", "vs".
   */
  function hasWord(value: string): boolean {
    return /[A-Za-z]{3,}/.test(value);
  }

  function looksLikeCopy(value: string): boolean {
    const s = value.replace(/\s+/g, ' ').trim();
    if (s.length < 3 || s.length > 190) return false;
    if (/[;={}[\]()|]/.test(s) || s.includes('=>') || s.includes('::')) return false;
    // Fragments of expressions the tag-to-tag scan can straddle.
    if (/&&|\|\||\?\s*$|^\d+\s/.test(s)) return false;
    // Blood group notation is the same word in every language.
    if (/^(A|B|AB|O)[+-]$/.test(s)) return false;
    if (!/[A-Za-z]/.test(s)) return false;
    if (/^[a-z0-9_\-./#:]+$/.test(s)) return false;          // tokens, urls, classes
    if (/^[A-Z0-9_ ]+$/.test(s)) return false;                // CONSTANT_CASE
    if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(s)) return false;    // camelCase
    if (/^(https?:|\/|#|@)/.test(s)) return false;
    if (/\b(flex|px-|py-|mt-|mb-|text-|bg-|rounded|border|grid|gap-|w-|h-)\b/.test(s)) return false;
    // A single lowercase word is a token far more often than a sentence.
    if (!s.includes(' ') && s[0] === s[0]!.toLowerCase()) return false;
    return true;
  }

  const covered = FILES.filter(({ path }) => isCovered(path));

  it('has every mobile route and every console page in view', () => {
    const mobileRoutes = covered.filter(({ path }) => path.startsWith('apps/mobile/app/'));
    // 50-odd route files today; the floor guards against a broken path walk,
    // not against the count changing.
    expect(mobileRoutes.length).toBeGreaterThan(40);
    expect(covered.length).toBeGreaterThan(100);
  });

  it.each([
    ['the donor app', 'apps/mobile/app/'],
    ['shared mobile components', 'apps/mobile/src/components/'],
    ['the hospital console', 'apps/hospital-web/app/'],
    ['the blood center console', 'apps/blood-center-web/app/'],
    ['the admin console', 'apps/admin-web/app/'],
  ])('leaves no hardcoded user-facing English in %s', (_name, prefix) => {
    const offenders = covered
      .filter(({ path }) => path.startsWith(prefix))
      .flatMap(({ path, text }) =>
        copyLiterals(text).map((literal) => `${path}: ${JSON.stringify(literal)}`),
      );
    expect(offenders).toEqual([]);
  });

  /**
   * The same sweep, inside template literals, for the app S11 rebuilt.
   *
   * It is scoped to the donor app deliberately. Turning it on for the staff
   * consoles reports twelve more strings -- "Good morning, ${firstName}.",
   * "Open unit ${reference}", "Updated ${time}", "${n} hr ${n} min",
   * "${n}% vs prev period", "${n}% acceptance", "Patient: ${reference}" -- and
   * they are real: the consoles also return bare 'No previous data' and build
   * `${n} unit${n !== 1 ? 's' : ''} required` by hand, which this check does not
   * even see. That is a console sweep of its own, and S11 is a mobile sprint. The
   * catalogue keys those strings will need (ops.common.updatedAt,
   * ops.inventory.openUnitLabel, ops.analytics.vsPreviousPeriod,
   * ops.analytics.acceptanceShare, ops.shipments.etaHoursMinutes,
   * ops.emergency.patientLabel, portal.greetingWithName) are already in all three
   * catalogues, so that sweep is a wiring job rather than a translation one.
   */
  describe('and none inside a template literal', () => {
    it.each([
      ['screens', 'apps/mobile/app/'],
      ['shared components', 'apps/mobile/src/components/'],
      ])('leaves none in %s', (_name, prefix) => {
      const offenders = covered
        .filter(({ path }) => path.startsWith(prefix))
        .flatMap(({ path, text }) =>
          copyLiterals(text, { templates: true }).map(
            (literal) => `${path}: ${JSON.stringify(literal)}`,
          ),
        );
      expect(offenders).toEqual([]);
    });
  });

});

describe('every language renders, and falls back where it has not been written', () => {
  const SAMPLE = [
    'booking.selectDate',
    'sos.canYouHelp',
    'insights.title',
    'ops.shipments.trackingTitle',
    'status.shipment.IN_TRANSIT',
    'medical.preparation.hydrate',
  ];

  it.each(SUPPORTED_LOCALES)('%s answers from its own catalogue', (locale) => {
    for (const key of SAMPLE) {
      const { text, resolvedFrom } = translate(CATALOGS, locale, key);
      expect(resolvedFrom).toBe(locale);
      expect(text).not.toBe(key);
      expect(text.trim()).not.toBe('');
    }
  });

  it('falls back to English for a key one language is missing, key by key', () => {
    const partial = { ...CATALOGS, uz: { booking: { selectDate: 'Sanani tanlang' } } };
    expect(translate(partial, 'uz', 'booking.selectDate').resolvedFrom).toBe('uz');
    expect(translate(partial, 'uz', 'sos.canYouHelp').resolvedFrom).toBe('en');
    expect(translate(partial, 'uz', 'sos.canYouHelp').text).toBe('Are you able to help?');
  });

  it('returns the key itself when no catalogue has it, so it is visible and greppable', () => {
    expect(translate(CATALOGS, 'uz', 'booking.notAKey').text).toBe('booking.notAKey');
  });
});

describe('the clinical review manifest matches the catalogue', () => {
  const MANIFEST = join(ROOT, 'docs', 'clinical-review.md');
  const text = readFileSync(MANIFEST, 'utf8');

  /** The key column of every term row, in file order. */
  const listed = [...text.matchAll(/^\| `(medical\.[\w.]+)` \|/gm)].map((m) => m[1]!);
  const clinical = collectKeys(en.medical as Catalog, 'medical').sort();

  it('lists every medical key, and nothing else', () => {
    // A term added to `medical` and not to the manifest ships to donors
    // without a clinician ever seeing it, which is the whole failure this
    // namespace exists to prevent. `pnpm clinical:review` regenerates it.
    expect(listed).toEqual(clinical);
  });

  it('carries all three languages for every term', () => {
    const rows = [...text.matchAll(/^\| `(medical\.[\w.]+)` \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$/gm)];
    expect(rows.length).toBe(clinical.length);
    const blank = rows
      .filter(([, , source, uzbek, russian]) => !source?.trim() || !uzbek?.trim() || !russian?.trim())
      .map(([, key]) => key);
    expect(blank).toEqual([]);
  });

  it('gives every term a review status', () => {
    const rows = [...text.matchAll(/^\| `(medical\.[\w.]+)` \|(?:[^|]*\|){3}\s*([^|]*?)\s*\|/gm)];
    const missing = rows.filter(([, , status]) => !status?.trim()).map(([, key]) => key);
    expect(missing).toEqual([]);
  });

  it('agrees with the English catalogue, so a reworded term cannot pass as reviewed', () => {
    const drifted: string[] = [];
    for (const m of text.matchAll(/^\| `(medical\.[\w.]+)` \| (.*?) \|/gm)) {
      const key = m[1]!;
      // `cell()` escapes pipes on the way in; undo that before comparing.
      const source = m[2]!.replace(/\\\|/g, '|');
      const catalogued = translate(CATALOGS, 'en', key).text.replace(/\n/g, ' ');
      if (source !== catalogued) drifted.push(`${key}: ${JSON.stringify(source)} vs ${JSON.stringify(catalogued)}`);
    }
    expect(drifted).toEqual([]);
  });
});
