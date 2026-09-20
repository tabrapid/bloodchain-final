import { PrismaClient, RoleCode } from '@prisma/client';

/**
 * Who may do what: the authorisation model, as reference data.
 *
 * Extracted from `prisma/seed.ts` so that the demo seed and the production
 * reference seed read the same list instead of two lists that agree today.
 * A permission the production seed did not know about is a role that silently
 * cannot do its job in production and works perfectly on every developer's
 * machine -- which is the kind of difference that is found by a blood centre,
 * on a Monday.
 *
 * Nothing here is clinical, operational or legal. It is the permission
 * vocabulary the guards already enforce, written down once.
 */

export const PERMISSIONS: { code: string; name: string }[] = [
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

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Every permission there is. The trailing 'donor.verify' was in the original
  // list too and is already covered by the spread; kept so this stays a
  // faithful extraction rather than a rewrite.
  [RoleCode.SUPER_ADMIN]: [...PERMISSIONS.map((permission) => permission.code), 'donor.verify'],
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

/**
 * Write the roles, permissions and their mapping.
 *
 * Upsert-only and idempotent, in both directions: re-running it adds what is
 * missing and changes nothing else. It never deletes a role, a permission or a
 * link -- removing a permission from a deployed system is a decision with
 * consequences for whoever currently holds it, and it is not one a seed script
 * should make silently on the next deploy.
 *
 * Safe to run against a production database. It is the only seeding that is.
 */
export async function seedAccessControl(db: PrismaClient): Promise<void> {
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: { code: permission.code, name: permission.name },
    });
  }

  for (const code of Object.values(RoleCode)) {
    const role = await db.role.upsert({
      where: { code },
      update: {},
      create: { code, name: code.replaceAll('_', ' ') },
    });

    for (const permissionCode of ROLE_PERMISSIONS[code] ?? []) {
      const permission = await db.permission.findUniqueOrThrow({ where: { code: permissionCode } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}
