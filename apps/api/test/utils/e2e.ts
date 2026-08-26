import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OrganizationType, RoleCode } from '@prisma/client';

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
        `run \`pnpm --filter @donor/api prisma:seed\` first.`,
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

/** Resolve the seeded hospital and blood centre, which most flows are scoped to. */
export async function seededOrganizations(app: INestApplication) {
  const db = app.get(PrismaService);

  const hospital = await db.organization.findFirstOrThrow({
    where: { type: OrganizationType.HOSPITAL },
  });
  const bloodCenter = await db.organization.findFirstOrThrow({
    where: { type: OrganizationType.BLOOD_CENTER },
  });

  return { hospital, bloodCenter };
}

export const API = '/api/v1';
