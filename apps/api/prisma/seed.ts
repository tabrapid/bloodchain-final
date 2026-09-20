import {
  AchievementRarity,
  AchievementType,
  AppointmentStatus,
  AppointmentType,
  BloodType,
  ChallengeStatus,
  ChallengeType,
  ChallengeVisibility,
  CommunityPostType,
  ComponentType,
  CourierStatus,
  DonationStatus,
  DonationType,
  EducationContentType,
  EmergencyMatchStatus,
  EmergencyStatus,
  LocationType,
  OrganizationServiceType,
  OrganizationType,
  Prisma,
  PrismaClient,
  ResultFlag,
  RhFactor,
  RoleCode,
  SlotStatus,
  TestCategory,
  XpTransactionType,
} from '@prisma/client';
import * as argon2 from 'argon2';
// The same guard the demo scripts use, imported rather than reimplemented:
// this file holds the TRUNCATE, so it is the one place that must not be able
// to disagree with them about what counts as a safe target.
// @ts-expect-error -- plain ESM module shared with scripts/, no declarations
import { checkLocalDatabase } from '../../../scripts/demo-guard.mjs';
import { seedUzGeographyAndOrganizations } from './seeds/uz-demo-organizations';
import { seedAccessControl } from './seeds/access-control.reference';

const db = new PrismaClient();

/**
 * How long ago the demo donor last gave blood.
 *
 * It was 7 days, which is inside the 56-day recovery window
 * (DONATION_COOLDOWN_DAYS) -- so the one account a demo signs in with could
 * neither book a donation nor accept an emergency: both are refused for a donor
 * still recovering, correctly and unhelpfully. Past the window, the account
 * opens on "Eligible now" and every flow is reachable.
 */
const DEMO_DONOR_LAST_DONATION_DAYS_AGO = 70;

/** Days before now, as a Date. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Days after a reference date, as a Date. */
function daysAfter(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * The 56-day recovery window the API enforces (DONATION_COOLDOWN_DAYS).
 *
 * The seeded donation carried `nextDonationDate: now + 56 days`, which made
 * every freshly seeded database put the demo donor back into recovery no matter
 * how long ago the donation was: the eligibility service prefers an explicit
 * `nextDonationDate` over the date it would compute from `completedAt`. The
 * window has to run from the donation, not from the seed run.
 */
const DONATION_COOLDOWN_DAYS = 56;

/**
 * Empty every table the seed owns, so seeding twice is the same as seeding
 * once.
 *
 * Only the users, roles and memberships were upserted; donations, appointments,
 * emergencies and laboratory results were plain creates keyed by a unique
 * reference, so the second run died on `donationReference` and left the
 * database half-populated. A demo needs to be able to return to a known state
 * on demand, which is exactly what that prevented.
 *
 * TRUNCATE rather than a hand-ordered list of deletes: the order is the FK
 * graph's business, not the seed's, and CASCADE already knows it. The
 * migration table is excluded -- dropping it would make Prisma re-run every
 * migration.
 */
async function resetSeedData(): Promise<void> {
  // `pnpm demo:reset` checks this before calling the seed, but the seed is also
  // reachable directly -- `pnpm prisma:seed`, `prisma db seed`, `prisma migrate
  // reset` -- and those paths bypassed the wrapper entirely. The only check
  // that ran here was NODE_ENV !== 'production', which passes for
  // NODE_ENV=staging, for an unset NODE_ENV pointed at a remote host, and for
  // any database name at all. Since the destructive statement lives in this
  // function, the guard has to live here too.
  const target = checkLocalDatabase({
    url: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    allowDatabase: process.env.DEMO_ALLOW_DATABASE,
  }) as { host: string; database: string };
  console.log(`Seeding "${target.database}" on ${target.host} (all seed-owned tables will be emptied).`);

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Shelf life for the development-only clinical release policy, in days.
 *
 * TEN YEARS, and deliberately absurd. No component keeps for ten years, which
 * is the point: this number exists so that development and demo units have
 * *some* known expiry for the release gate to accept, and it must be impossible
 * for anyone reading a screen, a log or this file to mistake it for a clinical
 * shelf life somebody signed off.
 *
 * The real value is a clinical decision nobody has made (CL-04), and the
 * release gate refuses rather than guesses when it is missing. This is not that
 * value and never becomes it: it is only ever read from a policy whose kind is
 * DEVELOPMENT_ONLY, every expiry derived from it is stamped
 * `ExpiryProvenance.DEVELOPMENT_POLICY`, and the whole policy is refused when
 * NODE_ENV=production.
 */
const DEVELOPMENT_SHELF_LIFE_DAYS = 3650;

/**
 * The development-only clinical release policy.
 *
 * Two independent barriers keep this away from real blood, and both have to
 * fail before it could release anything in production:
 *
 * 1. It is created only here, and this file refuses to run against anything but
 *    a local development database (`resetSeedData` above calls the same guard
 *    the demo scripts use). There is no API route that creates one.
 * 2. `ClinicalReleaseService` refuses a DEVELOPMENT_ONLY policy outright when
 *    NODE_ENV=production, whatever its status or effective dates.
 *
 * Every release made under it records `policyKind: DEVELOPMENT_ONLY` on the
 * `ReleaseDecision`, and the consoles read that field to label the clearance as
 * development rather than clinical. Nothing here is, or can be presented as, a
 * clinical clearance.
 */
async function seedDevelopmentReleasePolicy() {
  return db.clinicalReleasePolicy.create({
    data: {
      organizationId: null,
      scopeKey: 'PLATFORM',
      version: 1,
      status: 'APPROVED',
      kind: 'DEVELOPMENT_ONLY',
      title: 'Development stand-in — NOT a clinical release policy',
      sourceReference:
        'No clinical source. Created by prisma/seed.ts so development and demo flows can exercise the release path. Refused in production by ClinicalReleaseService.',
      approvedBy: null,
      approvedAt: new Date(),
      developmentShelfLifeDays: DEVELOPMENT_SHELF_LIFE_DAYS,
      // No requirements, and that is not an oversight: a DEVELOPMENT_ONLY
      // policy states no clinical requirements because it makes no clinical
      // claim. A PRODUCTION policy with an empty requirement set is refused by
      // the gate (CLINICAL_RELEASE_POLICY_HAS_NO_REQUIREMENTS) precisely so
      // that emptiness can never read as approval where it would matter.
    },
  });
}

async function main() {
  await resetSeedData();

  const developmentReleasePolicy = await seedDevelopmentReleasePolicy();

  // Roles, permissions and their mapping, from the shared reference module.
  //
  // It used to be declared here, which meant the production reference seed
  // would have had to declare it again -- two lists that agree on the day they
  // are written. A permission only one of them knows about is a role that works
  // on every developer's machine and silently cannot do its job in production.
  await seedAccessControl(db);

  const passwordHash = await argon2.hash('DevelopmentOnly!123');

  const superRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.SUPER_ADMIN } });
  const donorRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.DONOR } });
  const hospitalAdminRole = await db.role.findUniqueOrThrow({
    where: { code: RoleCode.HOSPITAL_ADMIN },
  });
  const hospitalStaffRole = await db.role.findUniqueOrThrow({
    where: { code: RoleCode.HOSPITAL_STAFF },
  });
  const bloodCenterAdminRole = await db.role.findUniqueOrThrow({
    where: { code: RoleCode.BLOOD_CENTER_ADMIN },
  });
  const bloodCenterStaffRole = await db.role.findUniqueOrThrow({
    where: { code: RoleCode.BLOOD_CENTER_STAFF },
  });
  const courierRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.COURIER } });
  const labTechnicianRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.LAB_TECHNICIAN } });
  const labReviewerRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.LAB_REVIEWER } });
  const labAdminRole = await db.role.findUniqueOrThrow({ where: { code: RoleCode.LAB_ADMIN } });

  const admin = await db.user.upsert({
    where: { email: 'admin@donor.local' },
    update: {},
    create: {
      email: 'admin@donor.local',
      firstName: 'Dev',
      lastName: 'Admin',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const donor = await db.user.upsert({
    where: { email: 'donor@donor.local' },
    update: {},
    create: {
      email: 'donor@donor.local',
      firstName: 'Sample',
      lastName: 'Donor',
      displayName: 'Sample D.',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
      donorProfile: {
        create: {
          bloodType: BloodType.O,
          rhFactor: RhFactor.POSITIVE,
          donorStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        },
      },
    },
  });

  const hospitalAdminUser = await db.user.upsert({
    where: { email: 'hospital.admin@donor.local' },
    update: {},
    create: {
      email: 'hospital.admin@donor.local',
      firstName: 'Hospital',
      lastName: 'Admin',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const hospitalStaffUser = await db.user.upsert({
    where: { email: 'hospital.staff@donor.local' },
    update: {},
    create: {
      email: 'hospital.staff@donor.local',
      firstName: 'Hospital',
      lastName: 'Staff',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const bloodCenterAdminUser = await db.user.upsert({
    where: { email: 'blood.center.admin@donor.local' },
    update: {},
    create: {
      email: 'blood.center.admin@donor.local',
      firstName: 'Blood Center',
      lastName: 'Admin',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const bloodCenterStaffUser = await db.user.upsert({
    where: { email: 'blood.center.staff@donor.local' },
    update: {},
    create: {
      email: 'blood.center.staff@donor.local',
      firstName: 'Blood Center',
      lastName: 'Staff',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const courierUser = await db.user.upsert({
    where: { email: 'courier@donor.local' },
    update: {},
    create: {
      email: 'courier@donor.local',
      firstName: 'Sample',
      lastName: 'Courier',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const labTechnicianUser = await db.user.upsert({
    where: { email: 'lab.technician@donor.local' },
    update: {},
    create: {
      email: 'lab.technician@donor.local',
      firstName: 'Lab',
      lastName: 'Technician',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const labReviewerUser = await db.user.upsert({
    where: { email: 'lab.reviewer@donor.local' },
    update: {},
    create: {
      email: 'lab.reviewer@donor.local',
      firstName: 'Lab',
      lastName: 'Reviewer',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const labAdminUser = await db.user.upsert({
    where: { email: 'lab.admin@donor.local' },
    update: {},
    create: {
      email: 'lab.admin@donor.local',
      firstName: 'Lab',
      lastName: 'Admin',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const hospitalOrg = await db.organization.create({
    data: {
      type: OrganizationType.HOSPITAL,
      name: 'Northstar Hospital (Development)',
      status: 'ACTIVE',
      address: '123 Medical Drive',
      email: 'contact@northstar-hospital.local',
      phone: '+14155550100',
      // Bookable for a donation, like every active hospital and blood centre.
      // The directory defaults this to false for a new, unfilled entry, so the
      // seed has to say it -- otherwise the booking flow, which asks for
      // organisations that accept donations, cannot see the demo hospital.
      acceptsDonations: true,
      hospital: { create: {} },
    },
  });

  const centerOrg = await db.organization.create({
    data: {
      type: OrganizationType.BLOOD_CENTER,
      name: 'Northstar Blood Center (Development)',
      status: 'ACTIVE',
      address: '456 Blood Way',
      email: 'contact@northstar-bloodcenter.local',
      phone: '+14155550200',
      acceptsDonations: true,
      bloodCenter: { create: {} },
    },
  });

  const mainStorage = await db.inventoryLocation.create({
    data: {
      organizationId: centerOrg.id,
      name: 'Main Storage',
      code: 'MS-01',
      type: LocationType.STORAGE,
      active: true,
    },
  });

  const quarantineStorage = await db.inventoryLocation.create({
    data: {
      organizationId: centerOrg.id,
      name: 'Quarantine Storage',
      code: 'QS-01',
      type: LocationType.QUARANTINE,
      active: true,
    },
  });

  const testingLab = await db.inventoryLocation.create({
    data: {
      organizationId: centerOrg.id,
      name: 'Testing Laboratory',
      code: 'TL-01',
      type: LocationType.PROCESSING,
      active: true,
    },
  });

  const issuingPoint = await db.inventoryLocation.create({
    data: {
      organizationId: centerOrg.id,
      name: 'Issuing Counter',
      code: 'IC-01',
      type: LocationType.DISTRIBUTION,
      active: true,
    },
  });

  /**
   * A pool of supporting donors, and more places to donate.
   *
   * With one donor and one blood centre, half the product cannot be shown: the
   * booking list has a single entry, a leaderboard has one row, and emergency
   * matching has nobody to rank. These exist so the demo has a system to walk
   * through rather than a single record.
   *
   * `donor@donor.local` is deliberately NOT among them -- it stays the empty,
   * free account the demo drives.
   */
  const supportDonorSpecs = [
    { email: 'aziza.donor@donor.local', firstName: 'Aziza', lastName: 'Karimova',
      bloodType: BloodType.O, rhFactor: RhFactor.NEGATIVE, city: 'Jizzakh', lat: 40.1180, lon: 67.8400 },
    { email: 'bekzod.donor@donor.local', firstName: 'Bekzod', lastName: 'Rahimov',
      bloodType: BloodType.A, rhFactor: RhFactor.POSITIVE, city: 'Jizzakh', lat: 40.1201, lon: 67.8461 },
    { email: 'dilnoza.donor@donor.local', firstName: 'Dilnoza', lastName: 'Yusupova',
      bloodType: BloodType.B, rhFactor: RhFactor.POSITIVE, city: 'Jizzakh', lat: 40.1093, lon: 67.8355 },
    { email: 'sardor.donor@donor.local', firstName: 'Sardor', lastName: 'Tursunov',
      bloodType: BloodType.O, rhFactor: RhFactor.POSITIVE, city: 'Arnasoy', lat: 40.1330, lon: 67.8710 },
  ];

  const supportDonors: { id: string }[] = [];
  for (const spec of supportDonorSpecs) {
    const user = await db.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        // The leaderboard falls back to "Anonymous Donor" without this, so an
        // unnamed seed made every row on the board identical.
        displayName: `${spec.firstName} ${spec.lastName.charAt(0)}.`,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        donorProfile: {
          create: {
            bloodType: spec.bloodType,
            rhFactor: spec.rhFactor,
            donorStatus: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            city: spec.city,
            consentLocation: true,
            latitude: spec.lat,
            longitude: spec.lon,
          },
        },
      },
    });
    await db.organizationMembership.upsert({
      where: {
        userId_organizationId_roleId: {
          userId: user.id,
          organizationId: centerOrg.id,
          roleId: donorRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: centerOrg.id,
        roleId: donorRole.id,
        status: 'ACTIVE',
      },
    });
    supportDonors.push(user);
  }

  /**
   * Donors who exist only to be the recorded source of seeded stock.
   *
   * The units on the shelf need recent collection dates to have any shelf life
   * left, and a recent donation puts its donor inside the recovery window. When
   * that donor was also in the emergency match pool, the pool was entirely
   * ineligible: before eligibility was checked during matching those donors
   * were alerted and then refused at Accept, and once it was checked the pool
   * became empty and no SOS could be demonstrated at all.
   *
   * Separating the two roles fixes both. These accounts hold the inventory
   * history; the supporting donors stay eligible so emergency matching has
   * somebody to find. They are ordinary donor accounts -- nothing about them is
   * special beyond who the stock is attributed to.
   */
  const inventorySourceSpecs = [
    { email: 'stock.donor1@donor.local', firstName: 'Kamola', lastName: 'Nazarova',
      bloodType: BloodType.A, rhFactor: RhFactor.POSITIVE },
    { email: 'stock.donor2@donor.local', firstName: 'Ulugbek', lastName: 'Saidov',
      bloodType: BloodType.B, rhFactor: RhFactor.NEGATIVE },
    { email: 'stock.donor3@donor.local', firstName: 'Gulnora', lastName: 'Abdullaeva',
      bloodType: BloodType.AB, rhFactor: RhFactor.POSITIVE },
  ];

  const inventorySourceDonors: { id: string }[] = [];
  for (const spec of inventorySourceSpecs) {
    const user = await db.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        displayName: `${spec.firstName} ${spec.lastName.charAt(0)}.`,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        donorProfile: {
          create: {
            bloodType: spec.bloodType,
            rhFactor: spec.rhFactor,
            donorStatus: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            city: 'Jizzakh',
          },
        },
      },
    });
    await db.organizationMembership.upsert({
      where: {
        userId_organizationId_roleId: {
          userId: user.id,
          organizationId: centerOrg.id,
          roleId: donorRole.id,
        },
      },
      update: {},
      create: { userId: user.id, organizationId: centerOrg.id, roleId: donorRole.id, status: 'ACTIVE' },
    });
    inventorySourceDonors.push(user);
  }

  // The demo donor gets a location too: without consent and coordinates the
  // hospital's live map has nothing to draw during an emergency response.
  await db.donorProfile.update({
    where: { userId: donor.id },
    data: { city: 'Jizzakh', district: 'Arnasoy', consentLocation: true,
            latitude: 40.1158, longitude: 67.8422 },
  });

  /** Two more hospitals and one more blood centre, so booking has a real list. */
  const extraOrgs = [
    { name: 'Jizzakh City Hospital', type: OrganizationType.HOSPITAL, slug: 'jizzakh',
      email: 'contact@jizzakh-city-hospital.local', city: 'Jizzakh', lat: 40.1250, lon: 67.8500 },
    { name: 'Arnasoy District Hospital', type: OrganizationType.HOSPITAL, slug: 'arnasoy',
      email: 'contact@arnasoy-hospital.local', city: 'Arnasoy', lat: 40.1400, lon: 67.9000 },
    { name: 'Republican Blood Center — Jizzakh', type: OrganizationType.BLOOD_CENTER, slug: 'rbc',
      email: 'contact@rbc-jizzakh.local', city: 'Jizzakh', lat: 40.1100, lon: 67.8300 },
  ];

  /**
   * Every organisation needs someone who can sign in to it.
   *
   * An organisation with no membership is invisible: the appointment a donor
   * books there reaches no portal, its emergencies can't be raised, and its lab
   * results can't be entered -- the record exists and nobody can act on it. The
   * extra organisations were seeded without staff, so booking anywhere but
   * Northstar was a dead end.
   */
  const extraStaffAccounts: { email: string; org: string; role: string }[] = [];
  const createdExtraOrgs = [];
  for (const org of extraOrgs) {
    const created = await db.organization.create({
      data: {
        name: org.name,
        type: org.type,
        email: org.email,
        phone: '+998 72 000 00 00',
        address: `${org.city}, Uzbekistan`,
        latitude: org.lat,
        longitude: org.lon,
        status: 'ACTIVE',
        acceptsDonations: true,
        ...(org.type === OrganizationType.HOSPITAL
          ? { hospital: { create: {} } }
          : { bloodCenter: { create: {} } }),
      },
    });
    createdExtraOrgs.push(created);

    const isHospital = org.type === OrganizationType.HOSPITAL;
    const staffRoles = [
      { suffix: 'admin', role: isHospital ? hospitalAdminRole : bloodCenterAdminRole,
        firstName: org.city, lastName: 'Admin' },
      { suffix: 'staff', role: isHospital ? hospitalStaffRole : bloodCenterStaffRole,
        firstName: org.city, lastName: 'Staff' },
    ];
    for (const spec of staffRoles) {
      const email = `${org.slug}.${spec.suffix}@donor.local`;
      const user = await db.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          firstName: spec.firstName,
          lastName: spec.lastName,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      await db.organizationMembership.upsert({
        where: {
          userId_organizationId_roleId: {
            userId: user.id,
            organizationId: created.id,
            roleId: spec.role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          organizationId: created.id,
          roleId: spec.role.id,
          status: 'ACTIVE',
        },
      });
      extraStaffAccounts.push({ email, org: org.name, role: spec.role.code });
    }
  }

  /**
   * Uzbekistan geography plus a demo organization in every region.
   *
   * Runs after the development organizations above so that the demo directory
   * sits alongside them rather than replacing them: the ids those appointments
   * and memberships point at are never touched.
   */
  const geo = await seedUzGeographyAndOrganizations(db);
  console.log(
    `  Geography: ${geo.regions} regions (ISO 3166-2:UZ), ${geo.districts} demo districts, ` +
      `${geo.organizations} demo organizations`,
  );

  /**
   * The five organisations a demo actually signs into are put on the map.
   *
   * They were created before the geography tables existed and never given a
   * region, a district, a service list or opening hours -- so the donor's
   * "filter by region" narrowed the list to organisations with no bookable
   * slots, and the organisation card for the one place you can actually book
   * showed no address and no hours. The seventeen directory entries had all of
   * this and none of the staff; these five had the staff and none of this.
   *
   * They are also marked `isDemo` here, because that is what they are. Every
   * name in this database is invented; a fictional hospital that does not say
   * so is the one piece of demo data that could mislead someone.
   */
  const operationalDirectory: {
    org: { id: string };
    regionCode: string;
    districtCode: string;
    address: string;
    latitude: number;
    longitude: number;
    providesLaboratory: boolean;
    services: OrganizationServiceType[];
  }[] = [
    {
      org: hospitalOrg,
      regionCode: 'UZ-TK',
      districtCode: 'yunusobod',
      address: 'Demo ko‘chasi 1, Toshkent',
      latitude: 41.3380,
      longitude: 69.2870,
      providesLaboratory: false,
      services: [OrganizationServiceType.WHOLE_BLOOD_DONATION, OrganizationServiceType.EMERGENCY_SUPPLY],
    },
    {
      org: centerOrg,
      regionCode: 'UZ-TK',
      districtCode: 'yakkasaroy',
      address: 'Demo ko‘chasi 2, Toshkent',
      latitude: 41.2820,
      longitude: 69.2500,
      providesLaboratory: true,
      services: [
        OrganizationServiceType.WHOLE_BLOOD_DONATION,
        OrganizationServiceType.PLASMA_DONATION,
        OrganizationServiceType.LABORATORY_TESTING,
        OrganizationServiceType.BLOOD_TYPING,
      ],
    },
    {
      org: createdExtraOrgs[0]!,
      regionCode: 'UZ-JI',
      districtCode: 'jizzax-shahri',
      address: 'Demo ko‘chasi 3, Jizzax',
      latitude: 40.1250,
      longitude: 67.8500,
      providesLaboratory: false,
      services: [OrganizationServiceType.WHOLE_BLOOD_DONATION, OrganizationServiceType.HEALTH_SCREENING],
    },
    {
      org: createdExtraOrgs[1]!,
      regionCode: 'UZ-JI',
      districtCode: 'arnasoy',
      address: 'Demo ko‘chasi 4, Arnasoy',
      latitude: 40.1400,
      longitude: 67.9000,
      providesLaboratory: false,
      services: [OrganizationServiceType.WHOLE_BLOOD_DONATION],
    },
    {
      org: createdExtraOrgs[2]!,
      regionCode: 'UZ-JI',
      districtCode: 'jizzax-shahri',
      address: 'Demo ko‘chasi 5, Jizzax',
      latitude: 40.1100,
      longitude: 67.8300,
      providesLaboratory: true,
      services: [
        OrganizationServiceType.WHOLE_BLOOD_DONATION,
        OrganizationServiceType.PLASMA_DONATION,
        OrganizationServiceType.PLATELET_DONATION,
        OrganizationServiceType.LABORATORY_TESTING,
        OrganizationServiceType.BLOOD_TYPING,
      ],
    },
  ];

  for (const entry of operationalDirectory) {
    const region = await db.region.findUnique({ where: { code: entry.regionCode } });
    if (!region) continue;
    const district = await db.district.findFirst({
      where: { regionId: region.id, code: entry.districtCode },
    });

    await db.organization.update({
      where: { id: entry.org.id },
      data: {
        regionId: region.id,
        districtId: district?.id ?? null,
        address: entry.address,
        latitude: entry.latitude,
        longitude: entry.longitude,
        providesLaboratory: entry.providesLaboratory,
        publicPhone: '+998 71 000 00 00',
        isDemo: true,
        verifiedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    await db.organizationService.deleteMany({ where: { organizationId: entry.org.id } });
    await db.organizationService.createMany({
      data: entry.services.map((service) => ({ organizationId: entry.org.id, service })),
      skipDuplicates: true,
    });

    // Monday to Friday 09:00-17:00, Saturday morning, closed Sunday -- the
    // same week the directory entries keep, so one organisation does not read
    // as more real than another.
    await db.organizationHours.deleteMany({ where: { organizationId: entry.org.id } });
    await db.organizationHours.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        organizationId: entry.org.id,
        dayOfWeek,
        isClosed: dayOfWeek === 0,
        opensAt: dayOfWeek === 0 ? null : '09:00',
        closesAt: dayOfWeek === 0 ? null : dayOfWeek === 6 ? '13:00' : '17:00',
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Bookable slots from today onward, at every place that takes appointments.
   *
   * The seed's only donation slot was already FULL and its test slot was two
   * days out, so "book a donation" had one option and the blood centre's
   * today-list was empty -- the two screens a demo opens first.
   */
  /**
   * Donations happen at hospitals as well as blood centres; laboratory tests
   * only at blood centres. Slots were seeded at blood centres alone, so three
   * of the five organisations showed "no available slots" and could not be
   * booked at all.
   */
  const slotHosts = [hospitalOrg, centerOrg, ...createdExtraOrgs];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const host of slotHosts) {
    for (let day = 0; day < 5; day += 1) {
      for (const hour of [9, 10, 11, 14, 15, 16]) {
        for (const type of [AppointmentType.BLOOD_DONATION, AppointmentType.BLOOD_TEST]) {
          const startAt = new Date(startOfToday);
          startAt.setDate(startAt.getDate() + day);
          startAt.setHours(type === AppointmentType.BLOOD_DONATION ? hour : hour, 0, 0, 0);
          if (startAt.getTime() < Date.now()) continue;
          await db.appointmentSlot.create({
            data: {
              organizationId: host.id,
              appointmentType: type,
              startAt,
              endAt: new Date(startAt.getTime() + 30 * 60000),
              capacity: 5,
              bookedCount: 0,
              status: SlotStatus.AVAILABLE,
            },
          });
        }
      }
    }
  }

  const todaySlot = await db.appointmentSlot.create({
    data: {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 60000),
      capacity: 3,
      bookedCount: 3,
      status: SlotStatus.FULL,
    },
  });

  /** When the demo donor's historical donation happened. */
  const lastDonationAt = daysAgo(DEMO_DONOR_LAST_DONATION_DAYS_AGO);

  const completedAppointment = await db.appointment.create({
    data: {
      referenceNumber: `DON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      slotId: todaySlot.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      status: AppointmentStatus.COMPLETED,
      scheduledStart: lastDonationAt,
      scheduledEnd: new Date(lastDonationAt.getTime() + 30 * 60000),
      completedAt: lastDonationAt,
    },
  });

  const completedDonation = await db.donation.create({
    data: {
      donationReference: `DONATION-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      appointmentId: completedAppointment.id,
      donationType: DonationType.WHOLE_BLOOD,
      status: DonationStatus.COMPLETED,
      bloodType: BloodType.O,
      rhFactor: RhFactor.POSITIVE,
      volumeMl: 450,
      collectionStartedAt: new Date(lastDonationAt.getTime() + 5 * 60000),
      collectionCompletedAt: new Date(lastDonationAt.getTime() + 35 * 60000),
      completedAt: new Date(lastDonationAt.getTime() + 35 * 60000),
      completedBy: hospitalStaffUser.id,
      nextDonationDate: daysAfter(lastDonationAt, DONATION_COOLDOWN_DAYS),
    },
  });

  await db.donationEvent.createMany({
    data: [
      {
        donationId: completedDonation.id,
        eventType: 'CREATED',
        actorId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        donationId: completedDonation.id,
        eventType: 'CHECKED_IN',
        actorId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        donationId: completedDonation.id,
        eventType: 'STARTED',
        actorId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 5 * 60000),
      },
      {
        donationId: completedDonation.id,
        eventType: 'COMPLETED',
        actorId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60000),
      },
    ],
  });

  /**
   * Two earlier donations, so the presentation account has a history rather
   * than a first-donation empty state.
   *
   * The dates are chosen to keep the medical record consistent: each donation
   * sits more than the 56-day recovery window after the one before it, and
   * each carries the next-eligible date that window implies. The most recent
   * of the three is the one above, 70 days ago, which is what makes the donor
   * eligible today for the donation booked live during the demo.
   */
  const earlierDonationDaysAgo = [350, 182];
  for (const daysBack of earlierDonationDaysAgo) {
    const donatedAt = daysAgo(daysBack);

    const historicSlot = await db.appointmentSlot.create({
      data: {
        organizationId: hospitalOrg.id,
        appointmentType: AppointmentType.BLOOD_DONATION,
        startAt: donatedAt,
        endAt: new Date(donatedAt.getTime() + 30 * 60000),
        capacity: 1,
        bookedCount: 1,
        status: SlotStatus.FULL,
      },
    });

    const historicAppointment = await db.appointment.create({
      data: {
        referenceNumber: `DON-${donatedAt.getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        donorId: donor.id,
        organizationId: hospitalOrg.id,
        slotId: historicSlot.id,
        appointmentType: AppointmentType.BLOOD_DONATION,
        status: AppointmentStatus.COMPLETED,
        scheduledStart: donatedAt,
        scheduledEnd: new Date(donatedAt.getTime() + 30 * 60000),
        completedAt: donatedAt,
      },
    });

    const historicDonation = await db.donation.create({
      data: {
        donationReference: `DONATION-${donatedAt.getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        donorId: donor.id,
        organizationId: hospitalOrg.id,
        appointmentId: historicAppointment.id,
        donationType: DonationType.WHOLE_BLOOD,
        status: DonationStatus.COMPLETED,
        bloodType: BloodType.O,
        rhFactor: RhFactor.POSITIVE,
        volumeMl: 450,
        collectionStartedAt: new Date(donatedAt.getTime() + 5 * 60000),
        collectionCompletedAt: new Date(donatedAt.getTime() + 35 * 60000),
        completedAt: new Date(donatedAt.getTime() + 35 * 60000),
        completedBy: hospitalStaffUser.id,
        nextDonationDate: daysAfter(donatedAt, DONATION_COOLDOWN_DAYS),
        createdAt: donatedAt,
      },
    });

    await db.donationEvent.createMany({
      data: (['CREATED', 'CHECKED_IN', 'STARTED', 'COMPLETED'] as const).map((eventType, index) => ({
        donationId: historicDonation.id,
        eventType,
        actorId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        createdAt: new Date(donatedAt.getTime() + index * 10 * 60000),
      })),
    });

    // A completed donation always produces a unit -- see donations.service.ts.
    // These were used long ago, so they do not inflate today's inventory.
    await db.bloodUnit.create({
      data: {
        unitReference: `BU-${donatedAt.getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        donationId: historicDonation.id,
        organizationId: hospitalOrg.id,
        bloodType: BloodType.O,
        rhFactor: RhFactor.POSITIVE,
        volumeMl: 450,
        status: 'USED',
        collectedAt: new Date(donatedAt.getTime() + 35 * 60000),
      },
    });
  }

  const cancelledAppointment = await db.appointment.create({
    data: {
      referenceNumber: `DON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      slotId: todaySlot.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      status: AppointmentStatus.CANCELLED,
      scheduledStart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60000),
      cancelledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 60000),
      cancellationReason: 'DONOR_CANCELLED',
    },
  });

  await db.donation.create({
    data: {
      donationReference: `DONATION-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      appointmentId: cancelledAppointment.id,
      donationType: DonationType.WHOLE_BLOOD,
      status: DonationStatus.CANCELLED,
      bloodType: BloodType.O,
      rhFactor: RhFactor.POSITIVE,
      cancellationReason: 'DONOR_CANCELLED',
      cancelledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 60000),
    },
  });

  /**
   * The demo donor's upcoming appointment, at a time nothing else can occupy.
   *
   * It used to be booked at `new Date()` -- the exact moment of seeding -- and
   * the API refuses a second appointment overlapping an existing one. So
   * whenever the seed happened to run near a bookable hour, the first thing a
   * presenter does ("book a donation") failed with "You already have an
   * appointment at this time", on the account the whole demo runs on.
   *
   * Noon tomorrow sits between the bookable blocks (09:00-11:00 and
   * 14:00-16:00), so it can never collide, and it still gives Home a real
   * "next appointment" card to show.
   */
  const upcomingAt = new Date();
  upcomingAt.setDate(upcomingAt.getDate() + 1);
  upcomingAt.setHours(12, 0, 0, 0);

  const upcomingSlot = await db.appointmentSlot.create({
    data: {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: upcomingAt,
      endAt: new Date(upcomingAt.getTime() + 30 * 60000),
      capacity: 1,
      bookedCount: 1,
      status: SlotStatus.FULL,
    },
  });

  const todayAppointment = await db.appointment.create({
    data: {
      referenceNumber: `DON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      slotId: upcomingSlot.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      status: AppointmentStatus.CONFIRMED,
      scheduledStart: upcomingAt,
      scheduledEnd: new Date(upcomingAt.getTime() + 30 * 60000),
    },
  });

  const bloodUnitsData = [
    { bloodType: BloodType.A, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 5 },
    { bloodType: BloodType.A, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 10 },
    { bloodType: BloodType.A, rhFactor: RhFactor.NEGATIVE, volumeMl: 450, daysAgo: 3 },
    { bloodType: BloodType.B, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 7 },
    { bloodType: BloodType.B, rhFactor: RhFactor.NEGATIVE, volumeMl: 450, daysAgo: 12 },
    { bloodType: BloodType.AB, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 8 },
    { bloodType: BloodType.AB, rhFactor: RhFactor.NEGATIVE, volumeMl: 450, daysAgo: 2 },
    { bloodType: BloodType.O, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 1 },
    { bloodType: BloodType.O, rhFactor: RhFactor.POSITIVE, volumeMl: 450, daysAgo: 6 },
    { bloodType: BloodType.O, rhFactor: RhFactor.NEGATIVE, volumeMl: 450, daysAgo: 4 },
  ];

  const bloodUnits = await Promise.all(
    bloodUnitsData.map(async (unit, index) => {
      const seedDonation = await db.donation.create({
        data: {
          donationReference: `SEED-DONATION-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
          // Attributed to the inventory-source donors, not to the demo account
          // and not to the emergency match pool. Ten donations dated 1-12 days
          // ago put whoever owns them inside the recovery window: on the demo
          // account that blocked booking, and on the match pool it left
          // emergency matching with no eligible donor to find.
          donorId: inventorySourceDonors[index % inventorySourceDonors.length]!.id,
          organizationId: centerOrg.id,
          donationType: DonationType.WHOLE_BLOOD,
          status: DonationStatus.COMPLETED,
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          volumeMl: unit.volumeMl,
          collectionStartedAt: new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000),
          collectionCompletedAt: new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000 + 30 * 60000),
          completedAt: new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000 + 30 * 60000),
        },
      });
      const collectedAt = new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000);
      // Quarantined stock has not been released and must not look as though it
      // has: no release timestamp, no expiry, no decision row.
      const quarantined = index === 2;

      const seededUnit = await db.bloodUnit.create({
        data: {
          unitReference: `BU-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
          donationId: seedDonation.id,
          organizationId: centerOrg.id,
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          componentType: ComponentType.WHOLE_BLOOD,
          volumeMl: unit.volumeMl,
          status: quarantined ? 'QUARANTINED' : 'AVAILABLE',
          locationId: quarantined ? quarantineStorage.id : mainStorage.id,
          collectedAt,
          // The expiry used to be `collectedAt + 42 days`: a component shelf
          // life, hard-coded in the seed, that nobody had signed. It now comes
          // from the development policy's own obviously-non-clinical shelf
          // life, and says so in `expirySource`.
          expiresAt: quarantined
            ? null
            : new Date(collectedAt.getTime() + DEVELOPMENT_SHELF_LIFE_DAYS * 24 * 60 * 60 * 1000),
          expirySource: quarantined ? 'UNKNOWN' : 'DEVELOPMENT_POLICY',
          // Seeded stock takes its group from the donor it was seeded against,
          // like every unit this system creates. Recorded, not implied.
          bloodGroupSource: 'DONOR_PROFILE_COPY',
          bloodGroupSourceNote: 'Seeded development stock',
          // Seeded AVAILABLE stock carries a release decision rather than
          // bypassing the gate. Without this the seed would be creating exactly
          // the state Sprint 7 exists to make impossible -- transfusable stock
          // that no policy ever cleared -- and every demo would be running
          // against it.
          clinicalReleasedAt: quarantined ? null : collectedAt,
        },
      });

      if (!quarantined) {
        await db.releaseDecision.create({
          data: {
            bloodUnitId: seededUnit.id,
            organizationId: centerOrg.id,
            policyId: developmentReleasePolicy.id,
            policyVersion: developmentReleasePolicy.version,
            policyKind: 'DEVELOPMENT_ONLY',
            outcome: 'RELEASED',
            reasonCode: 'RELEASED',
            unmetRequirements: [],
            decidedBy: null,
            decidedAt: collectedAt,
          },
        });
      }

      return seededUnit;
    }),
  );

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: admin.id,
        organizationId: hospitalOrg.id,
        roleId: superRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      organizationId: hospitalOrg.id,
      roleId: superRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: admin.id,
        organizationId: centerOrg.id,
        roleId: superRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      organizationId: centerOrg.id,
      roleId: superRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: donor.id,
        organizationId: hospitalOrg.id,
        roleId: donorRole.id,
      },
    },
    update: {},
    create: {
      userId: donor.id,
      organizationId: hospitalOrg.id,
      roleId: donorRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: hospitalAdminUser.id,
        organizationId: hospitalOrg.id,
        roleId: hospitalAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: hospitalAdminUser.id,
      organizationId: hospitalOrg.id,
      roleId: hospitalAdminRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: hospitalStaffUser.id,
        organizationId: hospitalOrg.id,
        roleId: hospitalStaffRole.id,
      },
    },
    update: {},
    create: {
      userId: hospitalStaffUser.id,
      organizationId: hospitalOrg.id,
      roleId: hospitalStaffRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: bloodCenterAdminUser.id,
        organizationId: centerOrg.id,
        roleId: bloodCenterAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: bloodCenterAdminUser.id,
      organizationId: centerOrg.id,
      roleId: bloodCenterAdminRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: bloodCenterStaffUser.id,
        organizationId: centerOrg.id,
        roleId: bloodCenterStaffRole.id,
      },
    },
    update: {},
    create: {
      userId: bloodCenterStaffUser.id,
      organizationId: centerOrg.id,
      roleId: bloodCenterStaffRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: courierUser.id,
        organizationId: centerOrg.id,
        roleId: courierRole.id,
      },
    },
    update: {},
    create: {
      userId: courierUser.id,
      organizationId: centerOrg.id,
      roleId: courierRole.id,
      status: 'ACTIVE',
    },
  });

  await db.courier.upsert({
    where: { userId: courierUser.id },
    update: {},
    create: {
      userId: courierUser.id,
      organizationId: centerOrg.id,
      displayName: 'John Courier',
      phone: '+14155550300',
      status: CourierStatus.AVAILABLE,
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: labTechnicianUser.id,
        organizationId: centerOrg.id,
        roleId: labTechnicianRole.id,
      },
    },
    update: {},
    create: {
      userId: labTechnicianUser.id,
      organizationId: centerOrg.id,
      roleId: labTechnicianRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: labReviewerUser.id,
        organizationId: centerOrg.id,
        roleId: labReviewerRole.id,
      },
    },
    update: {},
    create: {
      userId: labReviewerUser.id,
      organizationId: centerOrg.id,
      roleId: labReviewerRole.id,
      status: 'ACTIVE',
    },
  });

  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: labAdminUser.id,
        organizationId: centerOrg.id,
        roleId: labAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: labAdminUser.id,
      organizationId: centerOrg.id,
      roleId: labAdminRole.id,
      status: 'ACTIVE',
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(10, 0, 0, 0);

  const slots = [
    {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: tomorrow,
      endAt: new Date(tomorrow.getTime() + 30 * 60000),
      capacity: 3,
    },
    {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: new Date(tomorrow.getTime() + 60 * 60000),
      endAt: new Date(tomorrow.getTime() + 90 * 60000),
      capacity: 3,
    },
    {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_TEST,
      startAt: new Date(tomorrow.getTime() + 120 * 60000),
      endAt: new Date(tomorrow.getTime() + 150 * 60000),
      capacity: 5,
    },
    {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.CONSULTATION,
      startAt: new Date(tomorrow.getTime() + 180 * 60000),
      endAt: new Date(tomorrow.getTime() + 210 * 60000),
      capacity: 2,
    },
    {
      organizationId: centerOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: dayAfter,
      endAt: new Date(dayAfter.getTime() + 30 * 60000),
      capacity: 3,
    },
    {
      organizationId: centerOrg.id,
      appointmentType: AppointmentType.BLOOD_TEST,
      startAt: new Date(dayAfter.getTime() + 60 * 60000),
      endAt: new Date(dayAfter.getTime() + 90 * 60000),
      capacity: 5,
    },
  ];

  for (const slot of slots) {
    await db.appointmentSlot.create({
      data: {
        organizationId: slot.organizationId,
        appointmentType: slot.appointmentType,
        startAt: slot.startAt,
        endAt: slot.endAt,
        capacity: slot.capacity,
        bookedCount: 0,
        status: SlotStatus.AVAILABLE,
      },
    });
  }

  await db.bloodUnit.create({
    data: {
      unitReference: `BU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donationId: completedDonation.id,
      organizationId: hospitalOrg.id,
      bloodType: BloodType.O,
      rhFactor: RhFactor.POSITIVE,
      volumeMl: 450,
      status: 'COLLECTED',
      // The moment the donation it came from finished, not an unrelated one:
      // a unit collected 7 days ago from a donation completed 70 days ago is a
      // contradiction an auditor would find before the audience did.
      collectedAt: new Date(lastDonationAt.getTime() + 35 * 60000),
    },
  });

  const emergency1 = await db.emergencyRequest.create({
    data: {
      emergencyReference: `SOS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      hospitalId: hospitalOrg.id,
      bloodType: BloodType.O,
      rhFactor: RhFactor.NEGATIVE,
      unitsRequired: 2,
      urgencyLevel: 'CRITICAL',
      status: EmergencyStatus.ACTIVE,
      patientReference: 'ICU-PATIENT-001',
      description: 'Trauma patient in ICU, immediate surgery required',
      donationLocation: hospitalOrg.address || 'Northstar Hospital, Emergency Wing',
      createdBy: hospitalAdminUser.id,
    },
  });

  const emergency2 = await db.emergencyRequest.create({
    data: {
      emergencyReference: `SOS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      hospitalId: hospitalOrg.id,
      bloodType: BloodType.A,
      rhFactor: RhFactor.POSITIVE,
      unitsRequired: 1,
      urgencyLevel: 'HIGH',
      status: EmergencyStatus.MATCHING,
      patientReference: 'ER-PATIENT-002',
      description: 'Emergency cesarean section scheduled',
      donationLocation: hospitalOrg.address || 'Northstar Hospital, Maternity Ward',
      createdBy: hospitalAdminUser.id,
    },
  });

  const emergency3 = await db.emergencyRequest.create({
    data: {
      emergencyReference: `SOS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      hospitalId: hospitalOrg.id,
      bloodType: BloodType.B,
      rhFactor: RhFactor.POSITIVE,
      unitsRequired: 3,
      urgencyLevel: 'MEDIUM',
      status: EmergencyStatus.DRAFT,
      patientReference: 'ONCOLOGY-003',
      description: 'Chemotherapy patient, planned procedure',
      createdBy: hospitalAdminUser.id,
    },
  });

  /**
   * The seeded emergencies are answered by the *supporting* donors, never by
   * `donor@donor.local`.
   *
   * Matching skips any donor who already has an open match or response
   * (emergency.service.ts) -- correct behaviour, since a donor already on their
   * way to one emergency should not be pulled toward another. But it meant the
   * one account a demo signs in with arrived pre-occupied by seeded matches, so
   * every new emergency found nobody and the flow could not be shown at all.
   * The demo donor now starts free.
   */
  const emergencyMatch1 = await db.emergencyMatch.create({
    data: {
      emergencyRequestId: emergency1.id,
      donorId: supportDonors[0]!.id,
      status: EmergencyMatchStatus.MATCHED,
    },
  });

  const emergencyMatch2 = await db.emergencyMatch.create({
    data: {
      emergencyRequestId: emergency2.id,
      donorId: supportDonors[1]!.id,
      status: EmergencyMatchStatus.VIEWED,
      viewedAt: new Date(),
    },
  });

  await db.emergencyResponse.create({
    data: {
      emergencyRequestId: emergency1.id,
      matchId: emergencyMatch1.id,
      donorId: supportDonors[0]!.id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });

  const cbcTestType = await db.testType.create({
    data: {
      code: 'CBC',
      name: 'Complete Blood Count (CBC)',
      description: 'A complete blood count test measures several components of your blood including red blood cells, white blood cells, hemoglobin, hematocrit, and platelets.',
      category: TestCategory.HEMATOLOGY,
      isActive: true,
      displayOrder: 1,
    },
  });

  const hemoglobinParam = await db.testParameter.create({
    data: {
      testTypeId: cbcTestType.id,
      code: 'HEMOGLOBIN',
      name: 'Hemoglobin',
      unit: 'g/dL',
      dataType: 'numeric',
      required: true,
      displayOrder: 1,
    },
  });

  const rbcParam = await db.testParameter.create({
    data: {
      testTypeId: cbcTestType.id,
      code: 'RBC',
      name: 'Red Blood Cell Count',
      unit: 'million cells/mcL',
      dataType: 'numeric',
      required: true,
      displayOrder: 2,
    },
  });

  const wbcParam = await db.testParameter.create({
    data: {
      testTypeId: cbcTestType.id,
      code: 'WBC',
      name: 'White Blood Cell Count',
      unit: 'cells/mcL',
      dataType: 'numeric',
      required: true,
      displayOrder: 3,
    },
  });

  const hematocritParam = await db.testParameter.create({
    data: {
      testTypeId: cbcTestType.id,
      code: 'HEMATOCRIT',
      name: 'Hematocrit',
      unit: '%',
      dataType: 'numeric',
      required: true,
      displayOrder: 4,
    },
  });

  const plateletParam = await db.testParameter.create({
    data: {
      testTypeId: cbcTestType.id,
      code: 'PLATELETS',
      name: 'Platelet Count',
      unit: 'cells/mcL',
      dataType: 'numeric',
      required: true,
      displayOrder: 5,
    },
  });

  const bloodGroupTestType = await db.testType.create({
    data: {
      code: 'BLOOD_GROUP',
      name: 'Blood Grouping',
      description: 'Determines your blood type (A, B, AB, or O) and Rh factor (positive or negative).',
      category: TestCategory.BLOOD_GROUP,
      isActive: true,
      displayOrder: 2,
    },
  });

  await db.testParameter.create({
    data: {
      testTypeId: bloodGroupTestType.id,
      code: 'ABO',
      name: 'ABO Blood Type',
      dataType: 'text',
      required: true,
      displayOrder: 1,
    },
  });

  await db.testParameter.create({
    data: {
      testTypeId: bloodGroupTestType.id,
      code: 'RH_FACTOR',
      name: 'Rh Factor',
      dataType: 'text',
      required: true,
      displayOrder: 2,
    },
  });

  const ferritinTestType = await db.testType.create({
    data: {
      code: 'FERRITIN',
      name: 'Ferritin',
      description: 'Measures the amount of ferritin in your blood. Ferritin is a protein that stores iron in your body.',
      category: TestCategory.IRON,
      isActive: true,
      displayOrder: 3,
    },
  });

  const ferritinParam = await db.testParameter.create({
    data: {
      testTypeId: ferritinTestType.id,
      code: 'FERRITIN_LEVEL',
      name: 'Ferritin Level',
      unit: 'ng/mL',
      dataType: 'numeric',
      required: true,
      displayOrder: 1,
    },
  });

  /**
   * Adult reference ranges, one per parameter.
   *
   * There used to be a single range per test type, so the whole Complete Blood
   * Count was measured against 12-17.5 g/dL -- haemoglobin's range, applied to
   * platelet counts in the hundreds of thousands. A result flag derived from
   * that would be confidently wrong, so the API refuses to derive one unless
   * the range names the parameter it belongs to. These are the ranges that let
   * a published result read "Normal" or "High" on the donor's Health screen.
   */
  const referenceRanges = [
    { testTypeId: cbcTestType.id, parameterId: hemoglobinParam.id, min: 12.0, max: 17.5, unit: 'g/dL' },
    { testTypeId: cbcTestType.id, parameterId: rbcParam.id, min: 4.2, max: 6.1, unit: 'million cells/mcL' },
    { testTypeId: cbcTestType.id, parameterId: wbcParam.id, min: 4500, max: 11000, unit: 'cells/mcL' },
    { testTypeId: cbcTestType.id, parameterId: hematocritParam.id, min: 36.0, max: 52.0, unit: '%' },
    { testTypeId: cbcTestType.id, parameterId: plateletParam.id, min: 150000, max: 450000, unit: 'cells/mcL' },
    { testTypeId: ferritinTestType.id, parameterId: ferritinParam.id, min: 20.0, max: 200.0, unit: 'ng/mL' },
  ];
  for (const range of referenceRanges) {
    await db.testReferenceRange.create({
      data: {
        testTypeId: range.testTypeId,
        parameterId: range.parameterId,
        minValue: new Prisma.Decimal(range.min),
        maxValue: new Prisma.Decimal(range.max),
        unit: range.unit,
        notes: 'Normal range for adults',
        isActive: true,
      },
    });
  }

  const labProfile = await db.laboratoryProfile.create({
    data: {
      organizationId: centerOrg.id,
      name: 'Northstar Laboratory Services',
      address: centerOrg.address || '123 Blood Center Dr, Medical City, MC 12345',
      phone: '+1-555-LAB-0001',
      email: 'lab@bloodcenter.local',
      workingHours: 'Mon-Fri: 7:00 AM - 7:00 PM, Sat: 8:00 AM - 2:00 PM',
      isActive: true,
    },
  });

  // The flag the directory filters on is derived from the profile that was just
  // created, never asserted separately: an organisation runs laboratory testing
  // precisely when it holds a LaboratoryProfile.
  await db.organization.update({
    where: { id: centerOrg.id },
    data: { providesLaboratory: true },
  });

  await db.laboratoryProfile.update({
    where: { id: labProfile.id },
    data: {
      testTypes: {
        connect: [{ id: cbcTestType.id }, { id: bloodGroupTestType.id }, { id: ferritinTestType.id }],
      },
    },
  });

  /**
   * The second blood centre runs a laboratory too.
   *
   * With one laboratory profile in the database the "choose a laboratory" step
   * of the blood-test booking had exactly one entry, which is not a choice.
   */
  for (const org of createdExtraOrgs.filter((o) => o.type === OrganizationType.BLOOD_CENTER)) {
    const profile = await db.laboratoryProfile.create({
      data: {
        organizationId: org.id,
        name: `${org.name} Laboratory`,
        address: org.address ?? 'Jizzakh, Uzbekistan',
        phone: '+998 72 000 00 01',
        email: `lab.${org.id.slice(-6)}@donor.local`,
        workingHours: 'Mon-Sat: 8:00 - 18:00',
        isActive: true,
      },
    });
    await db.organization.update({
      where: { id: org.id },
      data: { providesLaboratory: true },
    });
    await db.laboratoryProfile.update({
      where: { id: profile.id },
      data: {
        testTypes: {
          connect: [{ id: cbcTestType.id }, { id: bloodGroupTestType.id }, { id: ferritinTestType.id }],
        },
      },
    });
  }

  const labSlot = await db.appointmentSlot.create({
    data: {
      organizationId: centerOrg.id,
      appointmentType: AppointmentType.BLOOD_TEST,
      startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      capacity: 3,
      bookedCount: 0,
      status: SlotStatus.AVAILABLE,
    },
  });

  const labAppointment = await db.appointment.create({
    data: {
      referenceNumber: `LAB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: centerOrg.id,
      slotId: labSlot.id,
      appointmentType: AppointmentType.BLOOD_TEST,
      status: AppointmentStatus.CONFIRMED,
      scheduledStart: labSlot.startAt,
      scheduledEnd: labSlot.endAt,
    },
  });

  const labResult = await db.laboratoryResult.create({
    data: {
      appointmentId: labAppointment.id,
      donorId: donor.id,
      laboratoryId: centerOrg.id,
      testTypeId: cbcTestType.id,
      status: 'PUBLISHED',
      performedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      performedBy: bloodCenterAdminUser.id,
      reviewedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      reviewedBy: bloodCenterAdminUser.id,
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      publishedBy: bloodCenterAdminUser.id,
    },
  });

  await db.laboratoryResultItem.createMany({
    data: [
      {
        resultId: labResult.id,
        parameterId: hemoglobinParam.id,
        value: '14.2',
        numericValue: new Prisma.Decimal(14.2),
        unit: 'g/dL',
        referenceMin: new Prisma.Decimal(12.0),
        referenceMax: new Prisma.Decimal(17.5),
        flag: ResultFlag.NORMAL,
      },
      {
        resultId: labResult.id,
        parameterId: rbcParam.id,
        value: '5.1',
        numericValue: new Prisma.Decimal(5.1),
        unit: 'million cells/mcL',
        referenceMin: new Prisma.Decimal(4.5),
        referenceMax: new Prisma.Decimal(5.5),
        flag: ResultFlag.NORMAL,
      },
      {
        resultId: labResult.id,
        parameterId: wbcParam.id,
        value: '7500',
        numericValue: new Prisma.Decimal(7500),
        unit: 'cells/mcL',
        referenceMin: new Prisma.Decimal(4500),
        referenceMax: new Prisma.Decimal(11000),
        flag: ResultFlag.NORMAL,
      },
      {
        resultId: labResult.id,
        parameterId: hematocritParam.id,
        value: '42',
        numericValue: new Prisma.Decimal(42),
        unit: '%',
        referenceMin: new Prisma.Decimal(36),
        referenceMax: new Prisma.Decimal(50),
        flag: ResultFlag.NORMAL,
      },
      {
        resultId: labResult.id,
        parameterId: plateletParam.id,
        value: '250000',
        numericValue: new Prisma.Decimal(250000),
        unit: 'cells/mcL',
        referenceMin: new Prisma.Decimal(150000),
        referenceMax: new Prisma.Decimal(400000),
        flag: ResultFlag.NORMAL,
      },
    ],
  });

  await db.laboratoryResultVersion.create({
    data: {
      resultId: labResult.id,
      version: 1,
      status: 'ENTERED',
      changedBy: bloodCenterAdminUser.id,
    },
  });

  await db.laboratoryResultVersion.create({
    data: {
      resultId: labResult.id,
      version: 2,
      status: 'PUBLISHED',
      changedBy: bloodCenterAdminUser.id,
    },
  });

  /**
   * Two earlier blood tests, so Health Trends has a trend to draw.
   *
   * A single measurement per parameter is not a trend: the endpoint answers
   * INSUFFICIENT_DATA and the chart is one dot, which reads as a broken screen
   * rather than as a donor who has only been tested once. Three points over a
   * year give every parameter a real line, and the test published live during
   * the demo adds a fourth in front of the audience.
   *
   * The values are inside the reference ranges defined above and move by small
   * amounts in one direction, so nothing here reads as a clinical finding.
   * Nobody is being diagnosed by a seed script.
   */
  const earlierTests = [
    {
      daysBack: 190,
      values: { hemoglobin: 13.6, rbc: 4.7, wbc: 6800, hematocrit: 40, platelets: 231000 },
    },
    {
      daysBack: 95,
      values: { hemoglobin: 13.9, rbc: 4.9, wbc: 7100, hematocrit: 41, platelets: 240000 },
    },
  ];

  for (const test of earlierTests) {
    const performedAt = daysAgo(test.daysBack);

    const historicLabSlot = await db.appointmentSlot.create({
      data: {
        organizationId: centerOrg.id,
        appointmentType: AppointmentType.BLOOD_TEST,
        startAt: performedAt,
        endAt: new Date(performedAt.getTime() + 30 * 60 * 1000),
        capacity: 1,
        bookedCount: 1,
        status: SlotStatus.FULL,
      },
    });

    const historicLabAppointment = await db.appointment.create({
      data: {
        referenceNumber: `LAB-${performedAt.getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        donorId: donor.id,
        organizationId: centerOrg.id,
        slotId: historicLabSlot.id,
        testTypeId: cbcTestType.id,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: AppointmentStatus.COMPLETED,
        scheduledStart: performedAt,
        scheduledEnd: new Date(performedAt.getTime() + 30 * 60 * 1000),
        completedAt: performedAt,
      },
    });

    const historicResult = await db.laboratoryResult.create({
      data: {
        appointmentId: historicLabAppointment.id,
        donorId: donor.id,
        laboratoryId: centerOrg.id,
        testTypeId: cbcTestType.id,
        status: 'PUBLISHED',
        performedAt,
        performedBy: bloodCenterAdminUser.id,
        reviewedAt: new Date(performedAt.getTime() + 24 * 60 * 60 * 1000),
        reviewedBy: bloodCenterAdminUser.id,
        publishedAt: new Date(performedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        publishedBy: bloodCenterAdminUser.id,
        createdAt: performedAt,
      },
    });

    await db.laboratoryResultItem.createMany({
      data: [
        { parameterId: hemoglobinParam.id, value: String(test.values.hemoglobin), numeric: test.values.hemoglobin,
          unit: 'g/dL', min: 12.0, max: 17.5 },
        { parameterId: rbcParam.id, value: String(test.values.rbc), numeric: test.values.rbc,
          unit: 'million cells/mcL', min: 4.5, max: 5.5 },
        { parameterId: wbcParam.id, value: String(test.values.wbc), numeric: test.values.wbc,
          unit: 'cells/mcL', min: 4500, max: 11000 },
        { parameterId: hematocritParam.id, value: String(test.values.hematocrit), numeric: test.values.hematocrit,
          unit: '%', min: 36, max: 50 },
        { parameterId: plateletParam.id, value: String(test.values.platelets), numeric: test.values.platelets,
          unit: 'cells/mcL', min: 150000, max: 400000 },
      ].map((item) => ({
        resultId: historicResult.id,
        parameterId: item.parameterId,
        value: item.value,
        numericValue: new Prisma.Decimal(item.numeric),
        unit: item.unit,
        referenceMin: new Prisma.Decimal(item.min),
        referenceMax: new Prisma.Decimal(item.max),
        flag: ResultFlag.NORMAL,
      })),
    });

    await db.laboratoryResultVersion.createMany({
      data: [
        { resultId: historicResult.id, version: 1, status: 'ENTERED', changedBy: bloodCenterAdminUser.id },
        { resultId: historicResult.id, version: 2, status: 'PUBLISHED', changedBy: bloodCenterAdminUser.id },
      ],
    });
  }


  /**
   * Gamification, community and education content.
   *
   * All of these tables were empty, so the Donate screen's campaigns and
   * challenges rows, the Community feed, the Education list, the achievements
   * grid and the leaderboard each rendered their empty state -- five screens
   * that look broken in a demo. Everything below is ordinary product content
   * seeded through the real models, so the screens read it the same way they
   * read anything else.
   */
  const achievementSpecs = [
    { code: 'FIRST_DONATION', type: AchievementType.DONATION_COUNT, name: 'First Drop',
      description: 'Complete your first blood donation.', icon: 'droplet',
      rarity: AchievementRarity.COMMON, criteria: { donations: 1 }, xpReward: 50, displayOrder: 1 },
    { code: 'DONATION_5', type: AchievementType.DONATION_COUNT, name: 'Regular Donor',
      description: 'Complete five blood donations.', icon: 'heart',
      rarity: AchievementRarity.RARE, criteria: { donations: 5 }, xpReward: 150, displayOrder: 2 },
    { code: 'DONATION_10', type: AchievementType.DONATION_COUNT, name: 'Lifeline',
      description: 'Complete ten blood donations.', icon: 'award',
      rarity: AchievementRarity.EPIC, criteria: { donations: 10 }, xpReward: 300, displayOrder: 3 },
    { code: 'EMERGENCY_HERO', type: AchievementType.EMERGENCY_RESPONSE_COUNT, name: 'Emergency Hero',
      description: 'Answer an emergency call and donate.', icon: 'siren',
      rarity: AchievementRarity.EPIC, criteria: { responses: 1 }, xpReward: 200, displayOrder: 4 },
    { code: 'HEALTH_AWARE', type: AchievementType.BLOOD_TEST_COUNT, name: 'Health Aware',
      description: 'Complete a laboratory blood test.', icon: 'activity',
      rarity: AchievementRarity.COMMON, criteria: { tests: 1 }, xpReward: 40, displayOrder: 5 },
    { code: 'PROFILE_COMPLETE', type: AchievementType.CUSTOM_EVENT, name: 'Ready to Give',
      description: 'Complete your donor profile.', icon: 'user-check',
      rarity: AchievementRarity.COMMON, criteria: { profile: true }, xpReward: 25, displayOrder: 6 },
    { code: 'XP_500', type: AchievementType.XP_MILESTONE, name: 'Five Hundred',
      description: 'Reach 500 XP.', icon: 'star',
      rarity: AchievementRarity.RARE, criteria: { xp: 500 }, xpReward: 100, displayOrder: 7 },
    { code: 'SCHOLAR', type: AchievementType.EDUCATION_COMPLETED, name: 'Scholar',
      description: 'Finish an education module.', icon: 'book-open',
      rarity: AchievementRarity.COMMON, criteria: { modules: 1 }, xpReward: 30, displayOrder: 8 },
  ];
  const achievements: Record<string, { id: string; xpReward: number }> = {};
  for (const spec of achievementSpecs) {
    // Upsert, not create, and this one is not cosmetic.
    //
    // `GamificationService.onModuleInit` seeds its own achievement catalogue by
    // code at every API boot. Running `pnpm demo:reset` against a running API
    // -- which the demo instructions tell you to do -- therefore races it: the
    // seed truncates, the API restarts (a regenerated Prisma client is a file
    // change, so `nest start --watch` reloads), the API writes its catalogue,
    // and the seed then dies on `Unique constraint failed on the fields: code`
    // somewhere in the middle, leaving a half-populated database and an error
    // that points at achievements when the cause is a lifecycle hook.
    //
    // Keyed by code, which is the unique column, so either order converges on
    // the same catalogue.
    const created = await db.achievement.upsert({
      where: { code: spec.code },
      create: { ...spec, isActive: true },
      update: { ...spec, isActive: true },
    });
    achievements[spec.code] = { id: created.id, xpReward: created.xpReward };
  }

  const badgeSpecs = [
    { code: 'BADGE_FIRST_DONATION', name: 'First Drop', description: 'Awarded for a first donation.',
      icon: 'droplet', rarity: AchievementRarity.COMMON, achievementCode: 'FIRST_DONATION', displayOrder: 1 },
    { code: 'BADGE_EMERGENCY_HERO', name: 'Emergency Hero', description: 'Awarded for answering an emergency.',
      icon: 'siren', rarity: AchievementRarity.EPIC, achievementCode: 'EMERGENCY_HERO', displayOrder: 2 },
    { code: 'BADGE_HEALTH_AWARE', name: 'Health Aware', description: 'Awarded for a completed blood test.',
      icon: 'activity', rarity: AchievementRarity.COMMON, achievementCode: 'HEALTH_AWARE', displayOrder: 3 },
    { code: 'BADGE_CONSISTENCY', name: 'Steady Hand', description: 'Awarded for donating on schedule.',
      icon: 'calendar-check', rarity: AchievementRarity.RARE, achievementCode: null, displayOrder: 4 },
  ];
  const badges: Record<string, string> = {};
  for (const spec of badgeSpecs) {
    const { achievementCode, ...rest } = spec;
    // Same race, same fix: `BadgeService.seedBadges` runs at every API boot.
    const data = {
      ...rest,
      isActive: true,
      achievementId: achievementCode ? achievements[achievementCode]!.id : null,
    };
    const created = await db.badge.upsert({
      where: { code: spec.code },
      create: data,
      update: data,
    });
    badges[spec.code] = created.id;
  }

  /**
   * Gamification standing for the demo donor and the supporting pool.
   *
   * The demo donor starts with the XP their seeded history earned, so the
   * profile does not open on "Level 1, 0 XP" next to a donation history. The
   * supporting donors get their own totals so the leaderboard has rows to rank.
   */
  const gamificationSpecs: { userId: string; xp: number; level: number; reputation: number }[] = [
    { userId: donor.id, xp: 340, level: 3, reputation: 45 },
    { userId: supportDonors[0]!.id, xp: 820, level: 5, reputation: 96 },
    { userId: supportDonors[1]!.id, xp: 610, level: 4, reputation: 71 },
    { userId: supportDonors[2]!.id, xp: 275, level: 2, reputation: 38 },
    { userId: supportDonors[3]!.id, xp: 150, level: 2, reputation: 22 },
  ];
  for (const spec of gamificationSpecs) {
    await db.gamificationProfile.upsert({
      where: { userId: spec.userId },
      update: { totalXp: spec.xp, level: spec.level, reputationScore: spec.reputation },
      create: {
        userId: spec.userId,
        totalXp: spec.xp,
        level: spec.level,
        reputationScore: spec.reputation,
        leaderboardVisibility: true,
      },
    });
  }

  // The demo donor's XP ledger, so the history behind the total is real.
  const donorXpLedger = [
    { amount: 25, type: XpTransactionType.PROFILE_COMPLETED, sourceType: 'PROFILE', sourceId: donor.id,
      description: 'Donor profile completed', daysAgo: 120 },
    { amount: 50, type: XpTransactionType.DONATION_COMPLETED, sourceType: 'DONATION', sourceId: completedDonation.id,
      description: 'Blood donation completed', daysAgo: DEMO_DONOR_LAST_DONATION_DAYS_AGO },
    { amount: 40, type: XpTransactionType.BLOOD_TEST_COMPLETED, sourceType: 'LAB_RESULT', sourceId: labResult.id,
      description: 'Blood test completed', daysAgo: 7 },
    { amount: 50, type: XpTransactionType.ACHIEVEMENT_UNLOCKED, sourceType: 'ACHIEVEMENT', sourceId: achievements.FIRST_DONATION!.id,
      description: 'Achievement unlocked: First Drop', daysAgo: DEMO_DONOR_LAST_DONATION_DAYS_AGO },
    { amount: 40, type: XpTransactionType.ACHIEVEMENT_UNLOCKED, sourceType: 'ACHIEVEMENT', sourceId: achievements.HEALTH_AWARE!.id,
      description: 'Achievement unlocked: Health Aware', daysAgo: 7 },
    { amount: 25, type: XpTransactionType.ACHIEVEMENT_UNLOCKED, sourceType: 'ACHIEVEMENT', sourceId: achievements.PROFILE_COMPLETE!.id,
      description: 'Achievement unlocked: Ready to Give', daysAgo: 120 },
    { amount: 30, type: XpTransactionType.EDUCATION_COMPLETED, sourceType: 'EDUCATION', sourceId: 'seed-education-1',
      description: 'Education module completed', daysAgo: 30 },
    { amount: 80, type: XpTransactionType.APPOINTMENT_COMPLETED, sourceType: 'APPOINTMENT', sourceId: completedAppointment.id,
      description: 'Appointment attended', daysAgo: DEMO_DONOR_LAST_DONATION_DAYS_AGO },
  ];
  for (const entry of donorXpLedger) {
    const { daysAgo: ago, ...rest } = entry;
    await db.xpTransaction.create({ data: { userId: donor.id, ...rest, createdAt: daysAgo(ago) } });
  }

  for (const code of ['FIRST_DONATION', 'HEALTH_AWARE', 'PROFILE_COMPLETE'] as const) {
    await db.achievementUnlock.create({
      data: {
        userId: donor.id,
        achievementId: achievements[code]!.id,
        unlockedAt: daysAgo(code === 'HEALTH_AWARE' ? 7 : DEMO_DONOR_LAST_DONATION_DAYS_AGO),
        progress: 1,
        target: 1,
      },
    });
  }
  for (const code of ['BADGE_FIRST_DONATION', 'BADGE_HEALTH_AWARE'] as const) {
    await db.userBadge.create({
      data: { userId: donor.id, badgeId: badges[code]!, earnedAt: daysAgo(DEMO_DONOR_LAST_DONATION_DAYS_AGO) },
    });
  }

  const campaignSpecs = [
    { organizationId: centerOrg.id, title: 'Jizzakh Winter Blood Drive',
      description: 'A week-long drive across Jizzakh to rebuild winter reserves. Walk-ins welcome.',
      startDate: daysAgo(3), endDate: daysAfter(new Date(), 11), location: 'Jizzakh city centre',
      bloodGroupsNeeded: [BloodType.O, BloodType.A, BloodType.B], targetParticipants: 200,
      status: 'ACTIVE' as const },
    { organizationId: createdExtraOrgs[0]!.id, title: 'University Donor Day',
      description: 'One day on campus with the mobile collection unit. First-time donors especially welcome.',
      startDate: daysAfter(new Date(), 5), endDate: daysAfter(new Date(), 6), location: 'Jizzakh State Pedagogical University',
      bloodGroupsNeeded: [BloodType.O, BloodType.AB], targetParticipants: 80,
      status: 'PUBLISHED' as const },
    { organizationId: createdExtraOrgs[2]!.id, title: 'Rare Types Register',
      description: 'Building a standing register of O-negative and AB donors for emergency call-outs.',
      startDate: daysAgo(20), endDate: daysAfter(new Date(), 40), location: 'Republican Blood Center — Jizzakh',
      bloodGroupsNeeded: [BloodType.O, BloodType.AB], targetParticipants: 120,
      status: 'ACTIVE' as const },
  ];
  const campaigns = [];
  for (const spec of campaignSpecs) campaigns.push(await db.campaign.create({ data: spec }));

  await db.campaignParticipant.create({
    data: { campaignId: campaigns[0]!.id, userId: donor.id, joinedAt: daysAgo(2) },
  });
  for (const [index, sd] of supportDonors.entries()) {
    await db.campaignParticipant.create({
      data: { campaignId: campaigns[index % campaigns.length]!.id, userId: sd.id, joinedAt: daysAgo(index + 1) },
    });
  }

  const challengeSpecs = [
    { title: 'Give twice this season', description: 'Complete two donations before the end of the season.',
      type: ChallengeType.DONATION_MILESTONE, status: ChallengeStatus.ACTIVE, visibility: ChallengeVisibility.PUBLIC,
      startDate: daysAgo(14), endDate: daysAfter(new Date(), 45), goal: 2, xpReward: 200,
      badgeId: badges.BADGE_CONSISTENCY! },
    { title: 'Know your blood', description: 'Finish the three education modules on blood donation.',
      type: ChallengeType.EDUCATION, status: ChallengeStatus.ACTIVE, visibility: ChallengeVisibility.PUBLIC,
      startDate: daysAgo(7), endDate: daysAfter(new Date(), 21), goal: 3, xpReward: 90, badgeId: null },
    { title: 'Campaign supporter', description: 'Join a blood drive campaign in your region.',
      type: ChallengeType.CAMPAIGN_PARTICIPATION, status: ChallengeStatus.ACTIVE, visibility: ChallengeVisibility.PUBLIC,
      startDate: daysAgo(10), endDate: daysAfter(new Date(), 30), goal: 1, xpReward: 60, badgeId: null },
  ];
  const challenges = [];
  for (const spec of challengeSpecs) challenges.push(await db.challenge.create({ data: spec }));

  await db.challengeParticipant.create({
    data: { challengeId: challenges[0]!.id, userId: donor.id, progress: 1, joinedAt: daysAgo(12) },
  });
  await db.challengeParticipant.create({
    data: { challengeId: challenges[2]!.id, userId: donor.id, progress: 1, joinedAt: daysAgo(2) },
  });

  const educationSpecs = [
    { type: EducationContentType.ARTICLE, title: 'Who can donate blood?',
      description: 'Age, weight and health requirements, and the common reasons for deferral.',
      body: 'Most healthy adults between 18 and 60 who weigh at least 50 kg can donate whole blood. You will be asked about recent illness, medication, tattoos and travel, and your haemoglobin is measured before every donation. Deferral is usually temporary: it protects both you and the person receiving your blood.',
      category: 'Eligibility', difficulty: 'BEGINNER', xpReward: 30, estimatedMinutes: 4, displayOrder: 1 },
    { type: EducationContentType.ARTICLE, title: 'What happens during a donation',
      description: 'Registration, screening, collection and recovery, step by step.',
      body: 'A whole blood donation takes about 10 minutes of actual collection and around 45 minutes end to end. You register, answer a short health questionnaire, have your haemoglobin and blood pressure checked, then give roughly 450 mL. Afterwards you rest for 10-15 minutes with something to drink before leaving.',
      category: 'Process', difficulty: 'BEGINNER', xpReward: 30, estimatedMinutes: 5, displayOrder: 2 },
    { type: EducationContentType.ARTICLE, title: 'Recovering well after you donate',
      description: 'Iron, fluids and the 56-day window between whole blood donations.',
      body: 'Your body replaces the fluid within a day and the red cells over about eight weeks, which is why whole blood donation is limited to once every 56 days. Drink extra water, eat iron-rich food, and avoid heavy lifting or strenuous exercise for the rest of the day.',
      category: 'Aftercare', difficulty: 'BEGINNER', xpReward: 30, estimatedMinutes: 4, displayOrder: 3 },
    { type: EducationContentType.ARTICLE, title: 'Blood groups and who you can help',
      description: 'ABO and Rh, universal donors, and why O-negative is always in demand.',
      body: 'The ABO system and the Rh factor together give the eight common blood groups. O-negative red cells can be given to anyone, which is why they are held for emergencies before a patient is typed; AB-positive donors are universal plasma donors. Knowing your group tells you exactly who your donation can reach.',
      category: 'Basics', difficulty: 'BEGINNER', xpReward: 30, estimatedMinutes: 6, displayOrder: 4 },
  ];
  const educationContent = [];
  for (const spec of educationSpecs) {
    educationContent.push(await db.educationalContent.create({ data: { ...spec, isActive: true } }));
  }
  await db.educationProgress.create({
    data: { userId: donor.id, contentId: educationContent[0]!.id, status: 'COMPLETED',
            startedAt: daysAgo(31), completedAt: daysAgo(30) },
  });
  await db.educationProgress.create({
    data: { userId: donor.id, contentId: educationContent[1]!.id, status: 'STARTED', startedAt: daysAgo(2) },
  });

  const postSpecs = [
    { type: CommunityPostType.CAMPAIGN, title: 'Winter blood drive is live',
      body: 'The Jizzakh Winter Blood Drive runs all week. O, A and B donors are especially needed — walk in any day between 9:00 and 17:00.',
      organizationId: centerOrg.id, campaignId: campaigns[0]!.id, publishedAt: daysAgo(3) },
    { type: CommunityPostType.IMPACT, title: 'Three lives from one donation',
      body: 'A single whole blood donation is separated into red cells, plasma and platelets — three components that can reach three different patients.',
      organizationId: centerOrg.id, publishedAt: daysAgo(6) },
    { type: CommunityPostType.MILESTONE, title: 'Aziza reached her fifth donation',
      body: 'Aziza K. completed her fifth donation this month. O-negative donors like her are the ones we call first in an emergency.',
      authorId: supportDonors[0]!.id, publishedAt: daysAgo(9) },
    { type: CommunityPostType.ANNOUNCEMENT, title: 'Republican Blood Center now takes online bookings',
      body: 'You can now reserve a donation or a laboratory test slot at the Republican Blood Center directly from the app.',
      organizationId: createdExtraOrgs[2]!.id, publishedAt: daysAgo(12) },
    { type: CommunityPostType.EDUCATION, title: 'What to eat before you donate',
      body: 'Have a full meal and plenty of water in the hours before your appointment, and go easy on fatty food — it can interfere with the tests run on your donation.',
      publishedAt: daysAgo(15) },
  ];
  for (const spec of postSpecs) {
    await db.communityPost.create({ data: { ...spec, status: 'PUBLISHED' } });
  }

  /**
   * The demo donor's notification inbox.
   *
   * The inbox rendered its empty state on an account with a donation, a
   * published lab result and a campaign it had joined -- every one of which
   * notifies in normal use. Deep links point at real routes so tapping a
   * notification goes somewhere.
   */
  const notificationSpecs = [
    { type: 'LABORATORY' as const, priority: 'NORMAL' as const,
      title: 'Your blood test results are ready',
      body: 'Complete Blood Count from Northstar Blood Center has been published. All parameters are within range.',
      deepLink: '/(app)/health', daysAgo: 7 },
    { type: 'DONATION' as const, priority: 'NORMAL' as const,
      title: 'Thank you for donating',
      body: 'Your 450 mL whole blood donation has been recorded. You earned 50 XP.',
      deepLink: '/(app)/donations', daysAgo: DEMO_DONOR_LAST_DONATION_DAYS_AGO },
    { type: 'GAMIFICATION' as const, priority: 'LOW' as const,
      title: 'Achievement unlocked: First Drop',
      body: 'You completed your first blood donation.',
      deepLink: '/(app)/gamification', daysAgo: DEMO_DONOR_LAST_DONATION_DAYS_AGO },
    { type: 'CAMPAIGN' as const, priority: 'NORMAL' as const,
      title: 'Jizzakh Winter Blood Drive is live',
      body: 'The drive runs all week at the Northstar Blood Center. You are signed up.',
      deepLink: '/(app)/campaigns', daysAgo: 3 },
    { type: 'APPOINTMENT' as const, priority: 'HIGH' as const,
      title: 'Upcoming blood test',
      body: 'Your laboratory appointment at Northstar Blood Center is in two days.',
      deepLink: '/(app)/calendar', daysAgo: 1 },
  ];
  for (const [index, spec] of notificationSpecs.entries()) {
    const { daysAgo: ago, ...rest } = spec;
    await db.notification.create({
      data: {
        recipientId: donor.id,
        ...rest,
        // The two oldest are already read, so the inbox shows both states.
        status: index >= 3 ? 'DELIVERED' : 'READ',
        readAt: index >= 3 ? null : daysAgo(ago),
        createdAt: daysAgo(ago),
      },
    });
  }

  /**
   * Demo Donor B: inside the recovery window.
   *
   * The primary demo donor is deliberately eligible so every flow is reachable.
   * Showing the other half of the rule -- "you gave 12 days ago, you are not
   * eligible until..." -- needs a second account rather than a contradictory
   * state on the first one.
   */
  const recentDonorUser = await db.user.upsert({
    where: { email: 'recent.donor@donor.local' },
    update: {},
    create: {
      email: 'recent.donor@donor.local',
      firstName: 'Nodira',
      lastName: 'Ergasheva',
      displayName: 'Nodira E.',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
      donorProfile: {
        create: {
          bloodType: BloodType.A,
          rhFactor: RhFactor.NEGATIVE,
          donorStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          city: 'Jizzakh',
          consentLocation: true,
          latitude: 40.1205,
          longitude: 67.8440,
        },
      },
    },
  });
  await db.organizationMembership.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: recentDonorUser.id, organizationId: centerOrg.id, roleId: donorRole.id,
      },
    },
    update: {},
    create: { userId: recentDonorUser.id, organizationId: centerOrg.id, roleId: donorRole.id, status: 'ACTIVE' },
  });
  const recentDonationAt = daysAgo(12);
  await db.donation.create({
    data: {
      donationReference: `DONATION-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: recentDonorUser.id,
      organizationId: centerOrg.id,
      donationType: DonationType.WHOLE_BLOOD,
      status: DonationStatus.COMPLETED,
      bloodType: BloodType.A,
      rhFactor: RhFactor.NEGATIVE,
      volumeMl: 450,
      collectionStartedAt: recentDonationAt,
      collectionCompletedAt: new Date(recentDonationAt.getTime() + 30 * 60000),
      completedAt: new Date(recentDonationAt.getTime() + 30 * 60000),
      completedBy: bloodCenterStaffUser.id,
      nextDonationDate: daysAfter(recentDonationAt, DONATION_COOLDOWN_DAYS),
    },
  });
  await db.gamificationProfile.upsert({
    where: { userId: recentDonorUser.id },
    update: {},
    create: { userId: recentDonorUser.id, totalXp: 95, level: 1, reputationScore: 12, leaderboardVisibility: true },
  });

  console.log('Seeded development data:');
  console.log('=== SUPER_ADMIN ===');
  console.log('  admin@donor.local / DevelopmentOnly!123');
  console.log('=== DONOR ===');
  console.log('  donor@donor.local / DevelopmentOnly!123');
  console.log('=== HOSPITAL STAFF ===');
  console.log('  hospital.admin@donor.local / DevelopmentOnly!123 (HOSPITAL_ADMIN)');
  console.log('  hospital.staff@donor.local / DevelopmentOnly!123 (HOSPITAL_STAFF)');
  console.log('=== BLOOD CENTER STAFF ===');
  console.log('  blood.center.admin@donor.local / DevelopmentOnly!123 (BLOOD_CENTER_ADMIN)');
  console.log('  blood.center.staff@donor.local / DevelopmentOnly!123 (BLOOD_CENTER_STAFF)');
  console.log('=== PER-ORGANIZATION STAFF ===');
  for (const acct of extraStaffAccounts) {
    console.log(`  ${acct.email} / DevelopmentOnly!123 (${acct.role} @ ${acct.org})`);
  }
  console.log('=== COURIER ===');
  console.log('  courier@donor.local / DevelopmentOnly!123 (COURIER)');
  console.log('=== LABORATORY STAFF ===');
  console.log('  lab.technician@donor.local / DevelopmentOnly!123 (LAB_TECHNICIAN)');
  console.log('  lab.reviewer@donor.local / DevelopmentOnly!123 (LAB_REVIEWER)');
  console.log('  lab.admin@donor.local / DevelopmentOnly!123 (LAB_ADMIN)');
  console.log('=== SECOND DONOR (inside recovery window) ===');
  console.log('  recent.donor@donor.local / DevelopmentOnly!123 (A-, donated 12 days ago, not yet eligible)');
  console.log('=== INVENTORY SOURCE DONORS (recorded source of seeded stock) ===');
  for (const spec of inventorySourceSpecs) {
    console.log(`  ${spec.email} / DevelopmentOnly!123 (${spec.bloodType}${spec.rhFactor === 'POSITIVE' ? '+' : '-'}, inside recovery window)`);
  }
  console.log('=== SUPPORTING DONORS (emergency match pool, all eligible) ===');

  for (const spec of supportDonorSpecs) {
    console.log(`  ${spec.email} / DevelopmentOnly!123 (${spec.bloodType}${spec.rhFactor === 'POSITIVE' ? '+' : '-'})`);
  }
  console.log('=== ORGANIZATIONS ===');
  console.log('  Northstar Hospital (Development) - Hospital');
  console.log('  Northstar Blood Center (Development) - Blood Center');
  for (const org of createdExtraOrgs) {
    console.log(`  ${org.name} - ${org.type}`);
  }
  console.log(`=== BOOKABLE SLOTS === ${await db.appointmentSlot.count({ where: { status: SlotStatus.AVAILABLE } })} available`);
  console.log(
    `=== CONTENT === ${achievementSpecs.length} achievements, ${badgeSpecs.length} badges, ` +
      `${campaigns.length} campaigns, ${challenges.length} challenges, ${postSpecs.length} community posts, ` +
      `${educationContent.length} education modules`,
  );
  console.log('=== EMERGENCY REQUESTS ===');
  console.log(`  ${emergency1.emergencyReference} - O- (CRITICAL, ACTIVE)`);
  console.log(`  ${emergency2.emergencyReference} - A+ (HIGH, MATCHING)`);
  console.log(`  ${emergency3.emergencyReference} - B+ (MEDIUM, DRAFT)`);
  console.log(
    'WARNING: These credentials are for local development only and must never be used in production.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
