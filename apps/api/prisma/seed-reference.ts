/**
 * The seed a production deployment runs. Not the demo one.
 *
 * DG-04 in the readiness register reads "no seed path for a production
 * deployment", which understates it. `prisma/seed.ts` TRUNCATEs every table it
 * owns and refuses to run against anything but a local database — correctly, on
 * both counts. So a production deployment today reaches a migrated, entirely
 * empty database: no roles, no permissions. Registration fails, because it
 * looks up the DONOR role. Every guard fails, because no role has any
 * permission. There is no way in.
 *
 * This is the way in. It writes the reference data the application needs to
 * function at all, and nothing else.
 *
 * ## What it writes
 *
 * - **Roles, permissions and their mapping.** From
 *   `seeds/access-control.reference.ts`, the same module the demo seed reads,
 *   so the two cannot drift.
 * - **Uzbekistan's regions.** The fourteen administrative divisions of
 *   ISO 3166-2:UZ, marked `OFFICIAL_REFERENCE` — a published standard, not a
 *   claim this project is making.
 *
 * ## What it deliberately does not write
 *
 * - **No users.** Not an administrator, not a placeholder. A production account
 *   is created by a person who knows the password, not by a script that has to
 *   invent one and then either print it or keep it.
 * - **No organisations.** Every organisation in the demo seed is `isDemo: true`
 *   (DG-02). Real ones are onboarded, not seeded.
 * - **No districts.** The demo districts are illustrative, marked `DEMO`. The
 *   authoritative list is SOATO, which this project does not have (DG-01).
 * - **No test types, parameters or reference ranges.** Those carry clinical
 *   content, and what they should contain is an open question for the
 *   laboratory reviewer (`review-packs/laboratory-review.md` LR-05). Seeding
 *   development ranges into production would put unreviewed clinical values in
 *   front of donors as health information.
 * - **No clinical release policy.** Emphatically. The development policy the
 *   demo seed installs is refused in production by `ClinicalReleaseService`,
 *   and creating a production one is a clinician's signature (LR-01), not a
 *   script's.
 * - **Nothing destructive.** No TRUNCATE, no delete, no reset. Every write is
 *   an upsert. Running it twice changes nothing; running it against a populated
 *   production database is safe, which is the point — it is how a new
 *   permission reaches an existing deployment.
 *
 * ## Running it
 *
 *     pnpm db:seed:reference
 *
 * Idempotent, so it belongs in the deployment procedure after
 * `prisma migrate deploy`, on every deploy rather than only the first.
 */
import { PrismaClient } from '@prisma/client';

import { ConsentPurpose, ConsentRequirementMode } from '@prisma/client';

import { seedAccessControl, PERMISSIONS } from './seeds/access-control.reference';
import { UZ_REGIONS, REGION_SOURCE } from '../src/modules/geography/uz-regions.reference';

const db = new PrismaClient();

/**
 * The fourteen regions of ISO 3166-2:UZ.
 *
 * Reference data from a published standard, which is why it is here and the
 * districts are not: the districts in the demo seed were created to make the
 * demo usable and are marked `DEMO` for that reason. The authoritative district
 * classifier is SOATO, and obtaining it is DG-01.
 */
async function seedOfficialGeography(): Promise<number> {
  for (const region of UZ_REGIONS) {
    const data = {
      nameUz: region.nameUz,
      nameRu: region.nameRu,
      nameEn: region.nameEn,
      centerEn: region.centerEn,
      sortOrder: region.sortOrder,
      source: REGION_SOURCE,
    };
    await db.region.upsert({
      where: { code: region.code },
      update: data,
      create: { code: region.code, ...data },
    });
  }
  return UZ_REGIONS.length;
}

/**
 * How strongly this deployment requires each processing purpose.
 *
 * PRODUCT CONFIGURATION, NOT LEGAL TRUTH. Whether a blood service may lawfully
 * refuse to register a donor who declines a given purpose is a question for
 * counsel (LP-01, LP-02), and these rows are where their answer will land. What
 * ships is the product owner's posture, and every row is changeable without a
 * migration.
 *
 * No consent DOCUMENT is seeded, here or anywhere. A purpose marked
 * REQUIRED_FOR_FEATURE with no approved document fails closed -- the feature is
 * refused rather than offered on the strength of wording nobody wrote.
 */
const CONSENT_POSTURE: { purpose: ConsentPurpose; mode: ConsentRequirementMode; note: string }[] = [
  {
    purpose: ConsentPurpose.MARKETING_COMMUNICATIONS,
    mode: ConsentRequirementMode.OPTIONAL,
    note: 'Campaign and marketing messages. Separate from service notices by design.',
  },
  {
    purpose: ConsentPurpose.SERVICE_NOTIFICATIONS,
    mode: ConsentRequirementMode.NOTICE_ONLY,
    note: 'Transactional notices -- appointment reminders, results ready. Not marketing, and not gated by a marketing refusal.',
  },
  {
    purpose: ConsentPurpose.EMERGENCY_LIVE_LOCATION,
    mode: ConsentRequirementMode.OPTIONAL,
    note: 'Live location during an emergency response.',
  },
  {
    purpose: ConsentPurpose.EMERGENCY_MATCHING,
    mode: ConsentRequirementMode.OPTIONAL,
    note: 'Being matched to emergency requests.',
  },
  {
    purpose: ConsentPurpose.CROSS_BORDER_PROCESSING,
    mode: ConsentRequirementMode.DISABLED,
    note: 'Off by default. A deployment that has not decided this must not be doing it.',
  },
  {
    purpose: ConsentPurpose.CORE_ACCOUNT,
    mode: ConsentRequirementMode.REQUIRED_FOR_FEATURE,
    note: 'Pending legal validation (LP-01). Fails closed until an approved document exists.',
  },
  {
    purpose: ConsentPurpose.HEALTH_DONATION_DATA,
    mode: ConsentRequirementMode.REQUIRED_FOR_FEATURE,
    note: 'Pending legal validation (LP-02). Fails closed until an approved document exists.',
  },
  {
    purpose: ConsentPurpose.HEALTHCARE_SHARING,
    mode: ConsentRequirementMode.REQUIRED_FOR_FEATURE,
    note: 'Pending legal validation (LP-03). Fails closed until an approved document exists.',
  },
];

async function seedConsentPosture(): Promise<number> {
  for (const row of CONSENT_POSTURE) {
    await db.consentRequirement.upsert({
      where: {
        scopeKey_purpose_featureKey: { scopeKey: 'PLATFORM', purpose: row.purpose, featureKey: '' },
      },
      update: { mode: row.mode, note: row.note },
      create: {
        purpose: row.purpose,
        scopeKey: 'PLATFORM',
        featureKey: '',
        mode: row.mode,
        note: row.note,
      },
    });
  }
  return CONSENT_POSTURE.length;
}

async function main(): Promise<void> {
  const target = new URL(process.env.DATABASE_URL ?? '');
  console.log(`\n  BloodChain reference seed → ${target.pathname.replace(/^\//, '')} on ${target.hostname}`);
  console.log('  Reference data only. Nothing is deleted, truncated or reset.\n');

  await seedAccessControl(db);
  const [roleCount, permissionCount, linkCount] = await Promise.all([
    db.role.count(),
    db.permission.count(),
    db.rolePermission.count(),
  ]);
  console.log(`  ✓ access control — ${roleCount} roles, ${permissionCount} permissions, ${linkCount} grants`);

  const posture = await seedConsentPosture();
  console.log(`  ✓ consent posture — ${posture} purposes configured (no documents; none may be invented)`);

  const regions = await seedOfficialGeography();
  console.log(`  ✓ geography — ${regions} regions (ISO 3166-2:UZ, OFFICIAL_REFERENCE)`);

  // Said out loud rather than left to be discovered, because an operator who
  // runs a seed reasonably expects to be able to sign in afterwards.
  console.log('');
  console.log('  Not written, deliberately:');
  console.log('    · no users — create the first administrator yourself; a script');
  console.log('      that invents a password has to either print it or keep it');
  console.log('    · no organisations — real ones are onboarded, not seeded (DG-02)');
  console.log('    · no districts — the demo ones are illustrative; SOATO is DG-01');
  console.log('    · no test types or reference ranges — unreviewed clinical values');
  console.log('      must not reach donors as health information (LR-05)');
  console.log('    · no clinical release policy — that is a clinician signature (LR-01),');
  console.log('      and the development policy is refused in production by design');
  console.log('');
  console.log(`  ${PERMISSIONS.length} permissions are now defined. Re-run this after any deploy.\n`);
}

main()
  .catch((error) => {
    console.error('\n  ✗ Reference seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
