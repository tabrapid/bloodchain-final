import {
  AppointmentStatus,
  AppointmentType,
  BloodType,
  ComponentType,
  CourierStatus,
  DonationStatus,
  DonationType,
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
} from '@prisma/client';
import * as argon2 from 'argon2';

const db = new PrismaClient();

async function main() {
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

  const completedAppointment = await db.appointment.create({
    data: {
      referenceNumber: `DON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      slotId: todaySlot.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      status: AppointmentStatus.COMPLETED,
      scheduledStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60000),
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
      collectionStartedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 5 * 60000),
      collectionCompletedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60000),
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60000),
      completedBy: hospitalStaffUser.id,
      nextDonationDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
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

  const todayAppointment = await db.appointment.create({
    data: {
      referenceNumber: `DON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      donorId: donor.id,
      organizationId: hospitalOrg.id,
      slotId: todaySlot.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      status: AppointmentStatus.CONFIRMED,
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 30 * 60000),
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
          donorId: donor.id,
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

  const emergencyMatch1 = await db.emergencyMatch.create({
    data: {
      emergencyRequestId: emergency1.id,
      donorId: donor.id,
      status: EmergencyMatchStatus.MATCHED,
    },
  });

  const emergencyMatch2 = await db.emergencyMatch.create({
    data: {
      emergencyRequestId: emergency2.id,
      donorId: donor.id,
      status: EmergencyMatchStatus.VIEWED,
      viewedAt: new Date(),
    },
  });

  await db.emergencyResponse.create({
    data: {
      emergencyRequestId: emergency1.id,
      matchId: emergencyMatch1.id,
      donorId: donor.id,
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

  await db.testParameter.create({
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

  await db.testReferenceRange.create({
    data: {
      testTypeId: cbcTestType.id,
      minValue: new Prisma.Decimal(12.0),
      maxValue: new Prisma.Decimal(17.5),
      unit: 'g/dL',
      notes: 'Normal range for adults',
      isActive: true,
    },
  });

  await db.testReferenceRange.create({
    data: {
      testTypeId: ferritinTestType.id,
      minValue: new Prisma.Decimal(20.0),
      maxValue: new Prisma.Decimal(200.0),
      unit: 'ng/mL',
      notes: 'Normal range for adults',
      isActive: true,
    },
  });

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
  console.log('=== COURIER ===');
  console.log('  courier@donor.local / DevelopmentOnly!123 (COURIER)');
  console.log('=== ORGANIZATIONS ===');
  console.log('  Northstar Hospital (Development) - Hospital');
  console.log('  Northstar Blood Center (Development) - Blood Center');
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
