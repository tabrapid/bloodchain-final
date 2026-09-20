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
