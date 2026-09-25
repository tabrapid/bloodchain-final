/**
 * Regenerates docs/clinical-review.md from the catalogues.
 *
 * Derived, never hand-typed: a term added to the `medical` namespace has to
 * appear on the review list without anyone remembering to add it, which is the
 * same reason CLINICAL_REVIEW_KEYS is computed rather than listed. Run
 * `pnpm clinical:review` after touching anything under `medical`; the spec in
 * packages/i18n fails if the file and the catalogue disagree.
 *
 * Reviewer decisions live in the Status and Notes columns and are preserved
 * across regenerations, so a clinician's sign-off is not lost when a new term
 * is added below it.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'clinical-review.md');

/** The locale files are plain object literals; strip the TS and import them. */
async function catalogue(locale) {
  const src = readFileSync(join(ROOT, 'packages/i18n/src/locales', `${locale}.ts`), 'utf8')
    .replace(/^import type[\s\S]*?;\n/m, '')
    .replace(/export const \w+: Catalog =/, 'export default');
  const url = `data:text/javascript;charset=utf-8;base64,${Buffer.from(src, 'utf8').toString('base64')}`;
  return (await import(url)).default;
}

/**
 * Where a term is rendered, and what a wrong one would cause.
 *
 * A reviewer cannot sign off a word in a table. They need to know which screen
 * shows it and what a donor or a member of staff would do differently if it
 * were wrong -- that is the difference between checking a translation and
 * checking a clinical claim. Both columns are derived rather than hand-written,
 * so a term added tomorrow arrives with its context already filled in.
 *
 * `CONSEQUENCE` is keyed on the sub-namespace because the namespace *is* the
 * clinical category: everything under `medical.eligibility` answers "may I
 * donate", everything under `medical.resultFlags` tells a donor how to read a
 * number about their own blood.
 */
const CONSEQUENCE = {
  services: 'What a site actually offers. Wrong here sends a donor to the wrong building.',
  donationTypes: 'Names the procedure the donor is consenting to. Wrong here is consent to the wrong thing.',
  eligibility: 'Tells a donor whether they may donate, and why not. Wrong here turns away a safe donor or invites an unsafe one.',
  markers: 'Names a laboratory measurement of the donor’s own blood.',
  resultFlags: 'Tells a donor whether a result of theirs is normal. Wrong here is read as reassurance or as alarm about their health.',
  resultFlagsByCode: 'The same flags keyed by the code the API sends. Must not drift from resultFlags.',
  appointmentTypes: 'Names what the donor booked, on the reminder they act on.',
  components: 'Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued.',
  assessment: 'The pre-donation decision staff record about a donor.',
  testCategories: 'Groups tests on the donor’s own results screen.',
  donorStatus: 'The donor’s standing, including deferral. Wrong here misstates whether they may donate.',
  verification: 'Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted.',
  verificationSource: 'Which kind of institution confirmed the donor’s blood group. Wrong here misstates how far the group can be trusted.',
  reference: 'Explains a reference range to a donor reading their own result.',
  aiSafety: 'How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice.',
  aiInsightTypes: 'Labels an AI-generated explanation by kind.',
  advice: 'Given to a donor as guidance about their own health.',
  preparation: 'What a donor should do before donating. Wrong here affects both the donation and the donor.',
  trendDirection: 'Whether one of the donor’s own measurements is rising or falling over time.',
};

/** An app path a reviewer can recognise, rather than one a developer can open. */
function screenName(relPath) {
  const app = relPath.startsWith('apps/mobile')
    ? 'Donor app'
    : relPath.startsWith('apps/hospital-web')
      ? 'Hospital console'
      : relPath.startsWith('apps/blood-center-web')
        ? 'Blood centre console'
        : relPath.startsWith('apps/admin-web')
          ? 'Admin console'
          : 'Shared';

  const leaf = relPath
    .replace(/^apps\/[^/]+\/(app|src|components|lib)\//, '')
    .replace(/^packages\/ui\/src\//, '')
    .replace(/\.tsx?$/, '')
    .replace(/\/index$/, '')
    .replace(/[()]/g, '');

  return `${app} › ${leaf}`;
}

/** Which screens render each key, by scanning the apps that consume the catalogue. */
function buildUsageIndex(keys) {
  const index = new Map(keys.map((key) => [key, new Set()]));
  const namespaces = new Map(keys.map((key) => [key, key.slice(0, key.lastIndexOf('.'))]));
  const roots = [
    'apps/mobile/app',
    'apps/mobile/src',
    'apps/hospital-web',
    'apps/blood-center-web',
    'apps/admin-web',
    'packages/ui/src',
  ];

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.spec\.tsx?$/.test(entry.name)) continue;

      const text = readFileSync(full, 'utf8');
      const where = screenName(relative(ROOT, full));

      for (const key of keys) {
        // Either the literal key, or the templated `medical.ns.${value}` form
        // most of these are actually rendered through.
        if (text.includes(`'${key}'`) || text.includes('`' + namespaces.get(key) + '.${')) {
          index.get(key).add(where);
        }
      }
    }
  };

  for (const root of roots) walk(join(ROOT, root));
  return index;
}

function flatten(node, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/** Reviewer columns from the existing file, keyed by translation key. */
function existingDecisions() {
  if (!existsSync(OUT)) return {};
  const decisions = {};
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    // Split on unescaped pipes only: a translation may legitimately contain
    // one, and `cell()` writes it as `\\|`.
    const cells = line.split(/(?<!\\)\|/).map((text) => text.trim());
    // A row is: '' | key | en | uz | ru | where | why | status | notes | ''
    // The six-column layout this file shipped with is still read, so a
    // clinician's sign-off from before the context columns existed survives
    // the first regeneration after them.
    if (!cells[1]?.startsWith('`medical.')) continue;
    if (cells.length === 10) {
      decisions[cells[1].replace(/`/g, '')] = { status: cells[7] ?? '', notes: cells[8] ?? '' };
    } else if (cells.length === 8) {
      decisions[cells[1].replace(/`/g, '')] = { status: cells[5] ?? '', notes: cells[6] ?? '' };
    }
  }
  return decisions;
}

/** A cell that cannot break the table or be mistaken for markup. */
const cell = (text) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const [en, uz, ru] = await Promise.all([catalogue('en'), catalogue('uz'), catalogue('ru')]);
const [fen, fuz, fru] = [flatten(en), flatten(uz), flatten(ru)];
const keys = Object.keys(fen).filter((key) => key.startsWith('medical.')).sort();
const kept = existingDecisions();
const usage = buildUsageIndex(keys);

const rows = keys.map((key) => {
  const prior = kept[key];
  const status = prior?.status || 'PENDING';
  const notes = prior?.notes || '';
  const namespace = key.split('.')[1] ?? '';
  const screens = [...(usage.get(key) ?? [])].sort();
  const where = screens.length > 0 ? screens.join('; ') : 'Not currently rendered';
  const why = CONSEQUENCE[namespace] ?? 'Shown to a donor or to staff in a clinical context.';

  return `| \`${key}\` | ${cell(fen[key])} | ${cell(fuz[key] ?? '—')} | ${cell(fru[key] ?? '—')} | ${cell(where)} | ${cell(why)} | ${status} | ${notes} |`;
});

const pending = rows.filter((row) => row.includes('| PENDING |')).length;

const body = `# Clinical review manifest

Every clinically meaningful string in the product, in all three languages, for a
clinician to confirm before release.

**${keys.length} terms — ${pending} pending, ${keys.length - pending} approved.**

## How to read this

The \`medical\` namespace exists so that everything a donor could act on
medically — what they are donating, whether they may donate, what a laboratory
value means — sits in one place instead of being spread across nine screens.
This file is that namespace, rendered. It is generated from the catalogues by
\`pnpm clinical:review\`, so a term added to \`medical\` appears here whether or
not anyone remembers to add it.

The Uzbek and Russian wording is **deliberately literal**. It was written to be
confirmed or replaced by a clinician, not improved by a translator — a
plausible-sounding translation of a laboratory flag is more dangerous than an
awkward one, because nobody re-reads it.

## How to review

Two columns exist so a reviewer can judge a term rather than merely read it.
**Where it appears** is derived by scanning the apps for the key, so it is what
the code actually does, not what anyone remembers. **Why it matters** says what
a donor or a member of staff would do differently if the wording were wrong —
which is the question that decides whether a term needs a clinician at all.

1. Read **Why it matters** first. It tells you what kind of mistake you are
   looking for.
2. Read the English source. If the English itself is wrong or misleading, say so
   in Notes — that is the more important finding, and no translation can fix it.
3. Check the Uzbek and Russian say the same clinical thing, not merely a
   similar-sounding thing. The wording is deliberately literal; replace it
   freely.
4. Open the screen named in **Where it appears** if the surrounding context
   changes the meaning. A word that is right in a list can be wrong as a badge.
5. Set Status to \`APPROVED\` or \`CHANGE REQUESTED\`, and put the replacement
   wording in Notes.

A term marked *Not currently rendered* is in the catalogue but no screen uses
it today. It still needs review before a screen starts to.

Re-running \`pnpm clinical:review\` preserves Status and Notes, so sign-off is
never lost when a new term is added — including across this change, which added
the two context columns.

### Priority

If the review has to be done in stages, these namespaces carry the most risk
and should be signed first:

1. \`medical.eligibility\` and \`medical.donorStatus\` — whether a donor may donate.
2. \`medical.resultFlags\` and \`medical.resultFlagsByCode\` — how a donor reads a
   result about their own blood.
3. \`medical.components\` and \`medical.donationTypes\` — what is collected, and
   what is issued to a patient.
4. \`medical.aiSafety\` — how far a machine-generated explanation may be trusted.

Everything else is informational and can follow.

Nothing here should be edited in the catalogue without a reviewer's decision
recorded in this file.

## Terms

| Translation key | English source | Uzbek (Latin) | Russian | Where it appears | Why it matters | Status | Reviewer notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

---

_Generated by \`pnpm clinical:review\` from \`packages/i18n/src/locales\`. Do not
edit the first four columns by hand — edit the catalogue and regenerate._
`;

writeFileSync(OUT, body);
console.log(`docs/clinical-review.md: ${keys.length} terms, ${pending} pending`);
