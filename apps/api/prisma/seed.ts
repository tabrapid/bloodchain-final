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
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The seed refuses to run with NODE_ENV=production.');
  }

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  await resetSeedData();

  const permissions = [
    { code: 'user.read.self', name: 'Read own profile' },
    { code: 'user.update.self', name: 'Update own profile' },
    { code: 'donor.read.self', name: 'Read own donor profile' },
    { code: 'donor.update.self', name: 'Update own donor profile' },
    { code: 'donor.verify', name: 'Verify donor blood type' },
    { code: 'organization.read', name: 'Read organization' },
    { code: 'organization.update', name: 'Update organization' },
    { code: 'hospital.read', name: 'Read hospital data' },
    { code: 'hospital.manage', name: 'Manage hospital' },
    { code: 'hospital.sos.create', name: 'Create SOS requests' },
    { code: 'hospital.donation.create', name: 'Create donations' },
    { code: 'hospital.inventory.read', name: 'Read hospital inventory' },
    { code: 'hospital.inventory.manage', name: 'Manage hospital inventory' },
    { code: 'blood_center.read', name: 'Read blood center data' },
    { code: 'blood_center.manage', name: 'Manage blood center' },
    { code: 'blood_test.create', name: 'Create blood tests' },
    { code: 'blood_test.update', name: 'Update blood tests' },
    { code: 'blood_test.publish', name: 'Publish blood test results' },
    { code: 'inventory.read', name: 'Read inventory' },
    { code: 'inventory.manage', name: 'Manage inventory' },
    { code: 'shipment.create', name: 'Create shipments' },
    { code: 'shipment.manage', name: 'Manage shipments' },
    { code: 'courier.read', name: 'Read courier data' },
    { code: 'courier.manage', name: 'Manage courier' },
    { code: 'analytics.read', name: 'Read analytics' },
    { code: 'audit.read', name: 'Read audit logs' },
    { code: 'admin.manage', name: 'Platform administration' },
  ];

  for (const perm of permissions) {
    await db.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: { code: perm.code, name: perm.name },
    });
  }

  const rolePermissions: Record<string, string[]> = {
    [RoleCode.SUPER_ADMIN]: [...permissions.map((p) => p.code), 'donor.verify'],
    [RoleCode.DONOR]: [
      'user.read.self',
      'user.update.self',
      'donor.read.self',
      'donor.update.self',
      'organization.read',
    ],
    [RoleCode.HOSPITAL_ADMIN]: [
      'user.read.self',
      'user.update.self',
      'donor.read.self',
      'donor.update.self',
      'donor.verify',
      'organization.read',
      'organization.update',
      'hospital.read',
      'hospital.manage',
      'hospital.sos.create',
      'hospital.donation.create',
      'hospital.inventory.read',
      'hospital.inventory.manage',
      'analytics.read',
      'audit.read',
    ],
    [RoleCode.HOSPITAL_STAFF]: [
      'user.read.self',
      'user.update.self',
      'donor.read.self',
      'donor.update.self',
      'donor.verify',
      'organization.read',
      'hospital.read',
      'hospital.sos.create',
      'hospital.donation.create',
      'hospital.inventory.read',
    ],
    [RoleCode.BLOOD_CENTER_ADMIN]: [
      'user.read.self',
      'user.update.self',
      'donor.read.self',
      'donor.update.self',
      'donor.verify',
      'organization.read',
      'organization.update',
      'blood_center.read',
      'blood_center.manage',
      'blood_test.create',
      'blood_test.update',
      'blood_test.publish',
      'inventory.read',
      'inventory.manage',
      'shipment.create',
      'shipment.manage',
      'analytics.read',
      'audit.read',
    ],
    [RoleCode.BLOOD_CENTER_STAFF]: [
      'user.read.self',
      'user.update.self',
      'donor.read.self',
      'donor.update.self',
      'donor.verify',
      'organization.read',
      'blood_center.read',
      'blood_test.create',
      'blood_test.update',
      'inventory.read',
      'shipment.create',
    ],
    [RoleCode.COURIER]: [
      'user.read.self',
      'user.update.self',
      'organization.read',
      'shipment.create',
      'shipment.manage',
      'courier.read',
    ],
    [RoleCode.LAB_TECHNICIAN]: [
      'user.read.self',
      'user.update.self',
      'organization.read',
      'blood_test.create',
      'blood_test.update',
    ],
    [RoleCode.LAB_REVIEWER]: [
      'user.read.self',
      'user.update.self',
      'organization.read',
      'blood_test.update',
      'blood_test.publish',
    ],
    [RoleCode.LAB_ADMIN]: [
      'user.read.self',
      'user.update.self',
      'organization.read',
      'organization.update',
      'blood_test.create',
      'blood_test.update',
      'blood_test.publish',
      'analytics.read',
      'audit.read',
    ],
  };

  for (const code of Object.values(RoleCode)) {
    const role = await db.role.upsert({
      where: { code },
      update: {},
      create: { code, name: code.replaceAll('_', ' ') },
    });

    const perms = rolePermissions[code] ?? [];
    for (const permCode of perms) {
      const permission = await db.permission.findUniqueOrThrow({ where: { code: permCode } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

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
          // The stock on the shelf came from the supporting donors, not the
          // demo account. Ten donations dated 1-12 days ago put the demo donor
          // inside the recovery window, so the account could not book or answer
          // an emergency -- while the units themselves need recent dates to
          // have any shelf life left.
          donorId: supportDonors[index % supportDonors.length]!.id,
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
      return db.bloodUnit.create({
        data: {
          unitReference: `BU-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
          donationId: seedDonation.id,
          organizationId: centerOrg.id,
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          componentType: ComponentType.WHOLE_BLOOD,
          volumeMl: unit.volumeMl,
          status: index === 2 ? 'QUARANTINED' : 'AVAILABLE',
          locationId: index === 2 ? quarantineStorage.id : mainStorage.id,
          collectedAt: new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - unit.daysAgo * 24 * 60 * 60 * 1000 + 42 * 24 * 60 * 60 * 1000),
        },
      });
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
      collectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60000),
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
    const created = await db.achievement.create({ data: { ...spec, isActive: true } });
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
    const created = await db.badge.create({
      data: {
        ...rest,
        isActive: true,
        achievementId: achievementCode ? achievements[achievementCode]!.id : null,
      },
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
  console.log('=== SUPPORTING DONORS (emergency match pool) ===');

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
