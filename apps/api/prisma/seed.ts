import {
  AppointmentStatus,
  AppointmentType,
  BloodType,
  DonationStatus,
  DonationType,
  OrganizationType,
  PrismaClient,
  RhFactor,
  RoleCode,
  SlotStatus,
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

  const todaySlot = await db.appointmentSlot.create({
    data: {
      organizationId: hospitalOrg.id,
      appointmentType: AppointmentType.BLOOD_DONATION,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 60000),
      capacity: 3,
      bookedCount: 1,
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

  await db.bloodUnit.create({
    data: {
      donationId: completedDonation.id,
      organizationId: hospitalOrg.id,
      bloodType: BloodType.O,
      rhFactor: RhFactor.POSITIVE,
      volumeMl: 450,
      status: 'COLLECTED',
      collectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60000),
    },
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
