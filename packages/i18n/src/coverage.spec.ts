import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATALOGS, en } from './locales';
import { SUPPORTED_LOCALES } from './locale';
import { collectKeys, createTranslator, translate } from './translate';

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
   * The screens Sprint 1C committed to covering. Listed explicitly rather than
   * scanned for, so adding a screen is a deliberate act and the list is the
   * record of what was promised.
   */
  const COVERED = [
    'apps/mobile/app/(booking)/',
    'apps/mobile/app/(app)/appointment/',
    'apps/mobile/app/(app)/donations/',
    'apps/mobile/app/(app)/laboratory/',
    'apps/mobile/app/(app)/health-trends/',
    'apps/mobile/app/(app)/insights/',
    'apps/mobile/app/(app)/notifications.tsx',
    'apps/mobile/app/sos.tsx',
    'apps/mobile/app/(app)/campaigns/',
    'apps/mobile/app/(app)/challenges/',
    'apps/mobile/app/(app)/education/',
    'apps/mobile/app/(app)/gamification/',
    'apps/mobile/app/(app)/privacy.tsx',
    'apps/mobile/app/(app)/security.tsx',
    'apps/mobile/app/(app)/profile/',
    'apps/hospital-web/app/',
    'apps/blood-center-web/app/',
    'apps/admin-web/app/',
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
  function copyLiterals(text: string): string[] {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^import[\s\S]*?from\s+'[^']*';$/gm, '');
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
      /\b(label|title|subtitle|placeholder|message|description|header|note|text|name|aria-label)\s*[=:]\s*'([^']{3,160})'/g,
    )) {
      if (looksLikeCopy(m[2]!)) found.push(m[2]!);
    }
    for (const m of stripped.matchAll(
      /\b(label|title|subtitle|placeholder|message|description|header|note|text|name|aria-label)="([^"]{3,160})"/g,
    )) {
      if (looksLikeCopy(m[2]!)) found.push(m[2]!);
    }
    return found;
  }

  function looksLikeCopy(value: string): boolean {
    const s = value.replace(/\s+/g, ' ').trim();
    if (s.length < 3 || s.length > 160) return false;
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

  it('has the covered screens in view, guarding against a stale path list', () => {
    expect(covered.length).toBeGreaterThan(40);
  });

  it('leaves no hardcoded user-facing English behind', () => {
    const offenders = covered.flatMap(({ path, text }) =>
      copyLiterals(text).map((literal) => `${path}: ${JSON.stringify(literal)}`),
    );
    expect(offenders).toEqual([]);
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
