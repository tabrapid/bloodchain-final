import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsService } from './permissions.service';

function makeMembership(roleCode: string, permissionCodes: string[]) {
  return {
    role: {
      code: roleCode,
      permissions: permissionCodes.map((code) => ({ permission: { code } })),
    },
  };
}

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organizationMembership: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('getUserPermissions', () => {
    it('only considers ACTIVE memberships', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([]);

      await service.getUserPermissions('user-1');

      expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', status: 'ACTIVE' } }),
      );
    });

    it('returns the permissions granted by a single role', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read', 'appointment.update']),
      ]);

      const result = await service.getUserPermissions('user-1');

      expect(result.sort()).toEqual(['appointment.read', 'appointment.update']);
    });

    it('unions permissions across multiple memberships and de-duplicates overlaps', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read', 'shared.read']),
        makeMembership(RoleCode.LAB_TECHNICIAN, ['blood_test.create', 'shared.read']),
      ]);

      const result = await service.getUserPermissions('user-1');

      expect(result.sort()).toEqual(['appointment.read', 'blood_test.create', 'shared.read']);
    });

    it('grants admin.manage to a SUPER_ADMIN even if no role permission lists it explicitly', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.SUPER_ADMIN, []),
      ]);

      const result = await service.getUserPermissions('user-1');

      expect(result).toContain('admin.manage');
    });

    it('returns an empty list for a user with no active memberships', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([]);

      expect(await service.getUserPermissions('user-1')).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('returns true when the permission is granted', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read']),
      ]);

      expect(await service.hasPermission('user-1', 'appointment.read')).toBe(true);
    });

    it('returns false when the permission is not granted', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read']),
      ]);

      expect(await service.hasPermission('user-1', 'donation.delete')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true when at least one requested permission is granted', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read']),
      ]);

      expect(await service.hasAnyPermission('user-1', ['donation.delete', 'appointment.read'])).toBe(true);
    });

    it('returns false when none of the requested permissions are granted', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read']),
      ]);

      expect(await service.hasAnyPermission('user-1', ['donation.delete', 'shipment.create'])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true only when every requested permission is granted', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        makeMembership(RoleCode.HOSPITAL_STAFF, ['appointment.read', 'appointment.update']),
      ]);

      expect(await service.hasAllPermissions('user-1', ['appointment.read', 'appointment.update'])).toBe(true);
      expect(await service.hasAllPermissions('user-1', ['appointment.read', 'donation.delete'])).toBe(false);
    });
  });
});
