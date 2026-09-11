import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Whether the generated Prisma client matches the schema in the repo.
 *
 * A client left over from an older schema is the worst failure mode this repo
 * has, because every symptom points somewhere else: the API stops compiling
 * with dozens of "property does not exist on type" errors, the seed dies on the
 * first unknown field so the database quietly keeps whatever it had, and the
 * accounts you expect are simply not there. You end up investigating the data,
 * or the network, while the cause is a stale file in node_modules.
 *
 * Rather than compare timestamps -- which say nothing about content -- this
 * looks for markers the current schema declares. If the client cannot see them,
 * it was generated from something older.
 */
const MARKERS = [
  { name: 'OrganizationType.SYSTEM', check: (c) => c.OrganizationType?.SYSTEM !== undefined },
  { name: 'MovementType.ADJUSTED', check: (c) => c.MovementType?.ADJUSTED !== undefined },
  { name: 'Prisma.PlatformSettingsScalarFieldEnum', check: (c) => c.Prisma?.PlatformSettingsScalarFieldEnum !== undefined },
  { name: 'DonorProfile.latitude', check: (c) => c.Prisma?.DonorProfileScalarFieldEnum?.latitude !== undefined },
  { name: 'TestReferenceRange.parameterId', check: (c) => c.Prisma?.TestReferenceRangeScalarFieldEnum?.parameterId !== undefined },
];

export function findStaleMarkers(client) {
  return MARKERS.filter((marker) => !marker.check(client)).map((marker) => marker.name);
}

/**
 * Loads the generated client and reports what is missing. Returns null when the
 * client cannot be loaded at all -- that is a different problem (dependencies
 * not installed) and says nothing about staleness.
 */
export function checkPrismaClient() {
  // Resolve from apps/api, not from this file. @prisma/client is a dependency
  // of the API package, and pnpm's non-flat node_modules means the repo root
  // cannot see it -- requiring it from here threw, the check returned null, and
  // the whole thing silently did nothing.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const from = createRequire(path.join(root, 'apps', 'api', 'package.json'));
  let client;
  try {
    client = from('@prisma/client');
  } catch {
    return null;
  }
  return { missing: findStaleMarkers(client) };
}
