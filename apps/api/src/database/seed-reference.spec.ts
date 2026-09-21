import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERMISSIONS, ROLE_PERMISSIONS } from '../../prisma/seeds/access-control.reference';

/**
 * What the production reference seed must never grow into.
 *
 * It is the only seeding that runs against a production database, so the two
 * ways it could become dangerous are both worth a test that fails loudly:
 *
 * 1. **It acquires something destructive.** The demo seed TRUNCATEs every table
 *    it owns. If a `deleteMany` or a reset ever drifts into this file — copied
 *    from the demo seed, added to make a re-run "clean" — it would run against
 *    real donor records.
 * 2. **It acquires data that should not exist in production.** A default
 *    administrator with a known password, the demo organisations, development
 *    test-reference ranges shown to donors as health information, or a clinical
 *    release policy, which is a clinician's signature and not a script's.
 *
 * These read the file rather than run it, because both failures are about what
 * the source says, and a behavioural test would need a production database to
 * prove anything about production.
 */
describe('the production reference seed', () => {
  // Lives under src/ because jest's rootDir is src/ — a spec in prisma/ would
  // never run, which is the quietest way for a guard like this to be useless.
  const PRISMA_DIR = join(__dirname, '..', '..', 'prisma');
  const source = readFileSync(join(PRISMA_DIR, 'seed-reference.ts'), 'utf8');

  /** Comments explain what is deliberately absent; only real code counts. */
  const code = source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
    })
    .join('\n');

  describe('is not destructive', () => {
    it.each(['TRUNCATE', 'deleteMany', '$executeRawUnsafe', 'DROP TABLE', 'migrate reset'])(
      'does not contain %s',
      (dangerous) => {
        expect(code).not.toContain(dangerous);
      },
    );

    it('writes only through upsert', () => {
      // `.create(` without a matching upsert would insert a duplicate on the
      // second deploy; this seed is meant to be run on every deploy.
      const bareCreates = code.match(/db\.\w+\.create\(/g) ?? [];
      expect(bareCreates).toEqual([]);
    });

    it('never calls the demo seed, which truncates', () => {
      expect(code).not.toContain('seedUzGeographyAndOrganizations');
      expect(code).not.toContain('resetSeedData');
    });
  });

  describe('writes no data that belongs to a person or a clinician', () => {
    it('creates no users', () => {
      // Not even an administrator. A script that invents a password has to
      // either print it or keep it, and both are worse than a person creating
      // the first account themselves.
      expect(code).not.toMatch(/db\.user\./);
      expect(code).not.toContain('argon2');
      expect(code).not.toContain('passwordHash');
    });

    it('creates no organisations', () => {
      // Every organisation in the demo seed is isDemo: true (DG-02). Real ones
      // are onboarded.
      expect(code).not.toMatch(/db\.organization\./);
    });

    it('creates no clinical release policy', () => {
      // The single most important line in this file is the one that is not
      // here. A production policy is a clinician's signature (LR-01); the
      // development one is refused in production by ClinicalReleaseService.
      expect(code).not.toMatch(/clinicalReleasePolicy/i);
      expect(code).not.toMatch(/clinicalReleaseRequirement/i);
    });

    it('creates no test types or reference ranges', () => {
      // Unreviewed clinical values must not reach donors as health
      // information (LR-05).
      expect(code).not.toMatch(/db\.testType\./);
      expect(code).not.toMatch(/db\.testParameter\./);
      expect(code).not.toMatch(/db\.testReferenceRange\./);
    });

    it('creates no districts, because the authoritative list is not in this repository', () => {
      // The demo districts are illustrative and marked DEMO. SOATO is DG-01.
      expect(code).not.toMatch(/db\.district\./);
    });

    it('writes only reference data and product configuration, nothing else', () => {
      const written = [...code.matchAll(/db\.(\w+)\.upsert\(/g)].map((match) => match[1]);
      const viaAccessControl = ['seedAccessControl'];

      // `consentRequirement` joined `region` in Sprint 9, and this assertion
      // caught it -- which is what it is for. It earns its place on three
      // counts, all of which a reviewer should be able to check:
      //
      //   * It carries NO legal text. A requirement row says how strongly this
      //     deployment requires a purpose; the wording lives in a
      //     ConsentDocument, and no document is seeded here or anywhere.
      //   * The application does not work without it. An unconfigured purpose
      //     fails closed, so a production deployment with no posture refuses
      //     every gated feature -- the same first-deployment hole DG-04 was.
      //   * It is configuration, not a claim. Every mode is changeable without
      //     a migration, and the legally-required-versus-optional question is
      //     still counsel's (LP-01, LP-02).
      //
      // Anything else appearing in this set needs the same argument made for
      // it, in writing, before this line is edited again.
      expect(new Set(written)).toEqual(new Set(['region', 'consentRequirement']));
      expect(viaAccessControl.every((call) => code.includes(call))).toBe(true);
    });

    it('seeds no consent document, only the posture', () => {
      // The distinction the whole consent design rests on. A posture is a
      // product decision; a document is wording somebody's counsel wrote, and
      // this repository has none and must not invent any.
      expect(code).not.toMatch(/db\.consentDocument\./);
      expect(code).not.toMatch(/db\.consentAcceptance\./);
    });
  });

  describe('shares one source of truth with the demo seed', () => {
    it('reads the access-control module rather than declaring its own list', () => {
      // Two lists agree on the day they are written. A permission only the demo
      // seed knows about is a role that works on every developer's machine and
      // silently cannot do its job in production.
      expect(code).toContain("from './seeds/access-control.reference'");
    });

    it('the demo seed reads the same module', () => {
      const demoSeed = readFileSync(join(PRISMA_DIR, 'seed.ts'), 'utf8');
      expect(demoSeed).toContain("from './seeds/access-control.reference'");
      expect(demoSeed).toContain('seedAccessControl(db)');
    });

    it('defines a non-trivial permission set, with every role mapping resolvable', () => {
      expect(PERMISSIONS.length).toBeGreaterThan(20);

      const known = new Set(PERMISSIONS.map((permission) => permission.code));
      const unknown = Object.entries(ROLE_PERMISSIONS).flatMap(([role, codes]) =>
        codes.filter((permissionCode) => !known.has(permissionCode)).map((c) => `${role}:${c}`),
      );

      // A role mapped to a permission that does not exist throws at seed time
      // (findUniqueOrThrow), which in production means a half-seeded database.
      expect(unknown).toEqual([]);
    });
  });
});
