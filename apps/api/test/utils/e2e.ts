import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  BloodType,
  OrganizationType,
  RhFactor,
  RoleCode,
  VerificationStatus,
} from '@prisma/client';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { PrismaService } from '../../src/database/prisma.service';
import { PermissionsService } from '../../src/modules/permissions/permissions.service';

/**
 * Shared harness for the domain e2e suites.
 *
 * Boots the real, unmocked application exactly as `main.ts` does (via the
 * shared `configureApp`) so these tests exercise the same routing, validation,
 * guards, filters and interceptors that production runs.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ logger: ['error'] });
  configureApp(app, app.get(ConfigService));
  await app.init();

  return app;
}

/**
 * Mint a real access token for a seeded user.
 *
 * Deliberately does NOT go through `POST /auth/login`: that route is rate
 * limited to 5 requests/60s (this app's own ThrottlerModule), and these suites
 * need six or more different actors signed in at once, so driving them through
 * the login route would make the suites trip the app's real rate limiter on
 * themselves. The login route is already covered end-to-end by
 * app.e2e-spec.ts; what the domain suites actually need is an authenticated
 * actor, not a re-test of login.
 *
 * The token is genuine either way — same JwtService, same secret, same
 * `{ sub, roles, permissions }` payload the login route mints, with roles and
 * permissions read from the database. Every guard on the routes under test
 * validates it for real.
 */
export async function tokenFor(app: INestApplication, email: string): Promise<string> {
  const db = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);
  const permissionsService = app.get(PermissionsService);

  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { where: { status: 'ACTIVE' }, include: { role: true } } },
  });

  if (!user) {
    throw new Error(
      `Seeded user ${email} not found. These suites run against a seeded database — ` +
        `run \`pnpm --filter @bloodchain/api prisma:seed\` first.`,
    );
  }

  const roles = user.memberships.map((m) => m.role.code) as RoleCode[];
  const permissions = await permissionsService.getUserPermissions(user.id);

  return jwt.signAsync(
    { sub: user.id, roles, permissions },
    {
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    },
  );
}

/**
 * A donor that belongs to one suite and nobody else.
 *
 * The domain suites used to share `donor@donor.local`, and that made them
 * quietly order-dependent on global state: completing a donation opens a
 * 56-day recovery window on that donor, so any suite that completed one --
 * or any *other* tool that had, `pnpm demo:verify` being the usual culprit --
 * made every later booking answer `409 DONOR_IN_RECOVERY_WINDOW`. The suite
 * that broke was never the suite that caused it, and the fix was always
 * "run `pnpm demo:reset` first", which is not a property a test suite should
 * need from its environment.
 *
 * The rule itself is real and stays exactly as it is. What changes is that
 * each suite gets a donor with no history, so the rule has nothing to fire on.
 *
 * The returned `cleanup` deletes the user, and `Donation`, `DonorProfile`,
 * `OrganizationMembership`, `Appointment` and (through `Donation`) `BloodUnit`
 * all cascade off it -- so a suite that dies halfway through still leaves
 * nothing behind for the next run to trip over.
 */
export interface TestDonor {
  id: string;
  email: string;
  token: string;
  cleanup: () => Promise<void>;
}

export async function createTestDonor(
  app: INestApplication,
  options: {
    /** Distinguishes this suite's donor in the database. */
    label: string;
    organizationId: string;
    bloodType?: BloodType;
    rhFactor?: RhFactor;
    verificationStatus?: VerificationStatus;
  },
): Promise<TestDonor> {
  const db = app.get(PrismaService);
  const donorRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.DONOR } });

  // Unique per run as well as per suite: two runs overlapping on one database
  // must not collide on the email's unique index.
  const email = `e2e.${options.label}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2, 8)}@donor.local`;

  const donor = await db.user.create({
    data: {
      email,
      firstName: 'E2E',
      lastName: options.label,
      // Tokens are minted directly (see `tokenFor`), so this hash is never
      // verified against anything -- but the column is not nullable.
      passwordHash: 'not-used-tokens-are-minted-directly',
      status: 'ACTIVE',
      emailVerified: true,
      donorProfile: {
        create: {
          bloodType: options.bloodType ?? BloodType.O,
          rhFactor: options.rhFactor ?? RhFactor.POSITIVE,
          donorStatus: 'ACTIVE',
          verificationStatus: options.verificationStatus ?? VerificationStatus.VERIFIED,
        },
      },
      memberships: {
        create: {
          organizationId: options.organizationId,
          roleId: donorRole.id,
          status: 'ACTIVE',
        },
      },
    },
  });

  return {
    id: donor.id,
    email,
    token: await tokenFor(app, email),
    cleanup: async () => {
      await db.user.deleteMany({ where: { id: donor.id } });
    },
  };
}

/** The demo accounts created by prisma/seed.ts. */
export const SEEDED = {
  superAdmin: 'admin@donor.local',
  donor: 'donor@donor.local',
  hospitalAdmin: 'hospital.admin@donor.local',
  hospitalStaff: 'hospital.staff@donor.local',
  bloodCenterAdmin: 'blood.center.admin@donor.local',
  bloodCenterStaff: 'blood.center.staff@donor.local',
  courier: 'courier@donor.local',
  labTechnician: 'lab.technician@donor.local',
  labReviewer: 'lab.reviewer@donor.local',
  labAdmin: 'lab.admin@donor.local',
} as const;

/**
 * Resolve the seeded hospital and blood centre, which most flows are scoped to.
 *
 * Resolved through the seeded staff accounts' own memberships rather than by
 * asking for "the first organization of this type". That earlier form was
 * silently wrong the day the Uzbekistan demo directory added seventeen more
 * organizations: `findFirst` with no ordering returned a demo blood centre that
 * nobody is a member of, so every blood-centre call in these suites answered
 * 403 and five suites went red at once -- correctly, because the API was
 * refusing a non-member.
 *
 * Asking "which organization does this actor belong to" makes the fixture say
 * what the tests actually mean, and no amount of future seed data can move it.
 *
 * The membership is the whole constraint. An `isDemo: false` filter used to sit
 * alongside it as a tiebreaker, which stopped being true the day every
 * fictional organization in this database was marked as demo data -- as all of
 * them are.
 */
export async function seededOrganizations(app: INestApplication) {
  const db = app.get(PrismaService);

  const hospital = await organizationOf(db, SEEDED.hospitalStaff, OrganizationType.HOSPITAL);
  const bloodCenter = await organizationOf(
    db,
    SEEDED.bloodCenterStaff,
    OrganizationType.BLOOD_CENTER,
  );

  return { hospital, bloodCenter };
}

/** The organization a seeded account actually holds an ACTIVE membership in. */
async function organizationOf(db: PrismaService, email: string, type: OrganizationType) {
  const membership = await db.organizationMembership.findFirst({
    where: {
      status: 'ACTIVE',
      user: { email },
      organization: { type },
    },
    orderBy: { createdAt: 'asc' },
    include: { organization: true },
  });

  if (!membership) {
    throw new Error(
      `Seeded account ${email} has no ACTIVE membership in a ${type}. ` +
        'These suites run against a seeded database — run `pnpm demo:reset` first.',
    );
  }

  return membership.organization;
}

export const API = '/api/v1';

/**
 * Poll until `check` returns a truthy value, or fail.
 *
 * Gamification runs off `@nestjs/event-emitter` handlers that are not awaited
 * by the request, so the HTTP response returns before the XP is credited.
 * Asserting straight after the response is a race that passes or fails on
 * machine speed; polling makes the assertion about the outcome rather than the
 * timing.
 */
export async function waitFor<T>(
  check: () => Promise<T | null | undefined | false>,
  { timeoutMs = 5000, intervalMs = 25, what = 'condition' } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value as T;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
