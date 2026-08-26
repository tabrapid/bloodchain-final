import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunityPostStatus, ContentReportStatus, RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminService } from './admin.service';

type MockPrisma = {
  role: { findUnique: jest.Mock; findMany: jest.Mock };
  permission: { findMany: jest.Mock };
  rolePermission: { deleteMany: jest.Mock; createMany: jest.Mock };
  organizationMembership: { findUnique: jest.Mock; update: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe('AdminService — roles & permissions', () => {
  let service: AdminService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      role: { findUnique: jest.fn(), findMany: jest.fn() },
      permission: { findMany: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      organizationMembership: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('listRoles', () => {
    it('returns each role with its permission codes, sorted', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          code: RoleCode.HOSPITAL_STAFF,
          name: 'HOSPITAL STAFF',
          permissions: [
            { permission: { code: 'hospital.read' } },
            { permission: { code: 'donor.read.self' } },
          ],
        },
      ]);

      const result = await service.listRoles();

      expect(result).toEqual([
        {
          id: 'role-1',
          code: RoleCode.HOSPITAL_STAFF,
          name: 'HOSPITAL STAFF',
          permissions: ['donor.read.self', 'hospital.read'],
        },
      ]);
    });
  });

  describe('listPermissions', () => {
    it('returns the full permission catalog', async () => {
      prisma.permission.findMany.mockResolvedValue([
        { id: 'p1', code: 'analytics.read', name: 'Read analytics' },
      ]);

      const result = await service.listPermissions();

      expect(result).toEqual([{ id: 'p1', code: 'analytics.read', name: 'Read analytics' }]);
    });
  });

  describe('updateRolePermissions', () => {
    it('replaces a role permission set and audit-logs the change', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        code: RoleCode.HOSPITAL_STAFF,
        name: 'HOSPITAL STAFF',
      });
      prisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1', code: 'hospital.read' },
        { id: 'perm-2', code: 'inventory.read' },
      ]);
      prisma.rolePermission.deleteMany.mockResolvedValue({});
      prisma.rolePermission.createMany.mockResolvedValue({});

      const result = await service.updateRolePermissions('admin-1', 'role-1', [
        'hospital.read',
        'inventory.read',
      ]);

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'role-1', permissionId: 'perm-1' },
          { roleId: 'role-1', permissionId: 'perm-2' },
        ],
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ROLE_PERMISSIONS_UPDATED',
            entityId: 'role-1',
          }),
        }),
      );
      expect(result.permissions).toEqual(['hospital.read', 'inventory.read']);
    });

    it('rejects unknown permission codes', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        code: RoleCode.HOSPITAL_STAFF,
        name: 'HOSPITAL STAFF',
      });
      prisma.permission.findMany.mockResolvedValue([{ id: 'perm-1', code: 'hospital.read' }]);

      await expect(
        service.updateRolePermissions('admin-1', 'role-1', ['hospital.read', 'not.a.real.permission']),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses to edit SUPER_ADMIN permissions', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-super',
        code: RoleCode.SUPER_ADMIN,
        name: 'SUPER ADMIN',
      });

      await expect(
        service.updateRolePermissions('admin-1', 'role-super', ['admin.manage']),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRolePermissions('admin-1', 'missing-role', ['hospital.read']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMembershipRole', () => {
    it('moves a membership to a new role and audit-logs the change', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-1',
        roleId: 'role-staff',
        role: { code: RoleCode.HOSPITAL_STAFF },
        organization: { id: 'org-1', name: 'Northstar Hospital' },
      });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', code: RoleCode.HOSPITAL_ADMIN });
      prisma.organizationMembership.update.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-1',
      });

      const result = await service.updateMembershipRole('admin-1', 'mem-1', 'role-admin');

      expect(prisma.organizationMembership.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { roleId: 'role-admin' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'MEMBERSHIP_ROLE_CHANGED',
            entityId: 'mem-1',
            metadata: expect.objectContaining({
              fromRole: RoleCode.HOSPITAL_STAFF,
              toRole: RoleCode.HOSPITAL_ADMIN,
            }),
          }),
        }),
      );
      expect(result.role).toBe(RoleCode.HOSPITAL_ADMIN);
    });

    it('is a no-op when the membership is already on the target role', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-1',
        roleId: 'role-admin',
        role: { code: RoleCode.HOSPITAL_ADMIN },
        organization: { id: 'org-1', name: 'Northstar Hospital' },
      });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', code: RoleCode.HOSPITAL_ADMIN });

      const result = await service.updateMembershipRole('admin-1', 'mem-1', 'role-admin');

      expect(prisma.organizationMembership.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(result.role).toBe(RoleCode.HOSPITAL_ADMIN);
    });

    it('throws NotFoundException for an unknown membership', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue(null);

      await expect(service.updateMembershipRole('admin-1', 'missing-mem', 'role-admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an unknown target role', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        organizationId: 'org-1',
        roleId: 'role-staff',
        role: { code: RoleCode.HOSPITAL_STAFF },
        organization: { id: 'org-1', name: 'Northstar Hospital' },
      });
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.updateMembershipRole('admin-1', 'mem-1', 'missing-role')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

type ModerationMockPrisma = {
  contentReport: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  communityPost: { update: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe('AdminService — content moderation', () => {
  let service: AdminService;
  let prisma: ModerationMockPrisma;

  beforeEach(async () => {
    prisma = {
      contentReport: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      communityPost: { update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('resolveContentReport', () => {
    it('dismisses a report without touching the post', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.PENDING,
      });
      prisma.contentReport.update.mockResolvedValue({
        id: 'report-1',
        status: ContentReportStatus.DISMISSED,
      });

      const result = await service.resolveContentReport('admin-1', 'report-1', 'DISMISS', 'Not a violation');

      expect(prisma.contentReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          status: ContentReportStatus.DISMISSED,
          reviewedBy: 'admin-1',
          reviewedAt: expect.any(Date),
          resolution: 'Not a violation',
        },
      });
      expect(prisma.communityPost.update).not.toHaveBeenCalled();
      expect(prisma.contentReport.updateMany).not.toHaveBeenCalled();
      expect(result.status).toBe(ContentReportStatus.DISMISSED);
    });

    it('hides the post and auto-resolves every other open report on it', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.PENDING,
      });
      prisma.contentReport.update.mockResolvedValue({
        id: 'report-1',
        status: ContentReportStatus.ACTIONED,
      });
      prisma.communityPost.update.mockResolvedValue({ id: 'post-1', status: CommunityPostStatus.HIDDEN });
      prisma.contentReport.updateMany.mockResolvedValue({ count: 2 });

      await service.resolveContentReport('admin-1', 'report-1', 'HIDE');

      expect(prisma.communityPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: CommunityPostStatus.HIDDEN },
      });
      expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
        where: {
          postId: 'post-1',
          id: { not: 'report-1' },
          status: { in: [ContentReportStatus.PENDING, ContentReportStatus.REVIEWED] },
        },
        data: expect.objectContaining({
          status: ContentReportStatus.ACTIONED,
          reviewedBy: 'admin-1',
        }),
      });
    });

    it('removes the post when action is REMOVE', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.REVIEWED,
      });
      prisma.contentReport.update.mockResolvedValue({ id: 'report-1', status: ContentReportStatus.ACTIONED });
      prisma.communityPost.update.mockResolvedValue({ id: 'post-1', status: CommunityPostStatus.REMOVED });
      prisma.contentReport.updateMany.mockResolvedValue({ count: 0 });

      await service.resolveContentReport('admin-1', 'report-1', 'REMOVE');

      expect(prisma.communityPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: CommunityPostStatus.REMOVED },
      });
    });

    it('rejects resolving a report that is already dismissed', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.DISMISSED,
      });

      await expect(service.resolveContentReport('admin-1', 'report-1', 'DISMISS')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.contentReport.update).not.toHaveBeenCalled();
    });

    it('rejects resolving a report that has already been actioned', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.ACTIONED,
      });

      await expect(service.resolveContentReport('admin-1', 'report-1', 'HIDE')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for an unknown report', async () => {
      prisma.contentReport.findUnique.mockResolvedValue(null);

      await expect(service.resolveContentReport('admin-1', 'missing', 'DISMISS')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getContentReport', () => {
    it('includes other reports filed against the same post', async () => {
      prisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        postId: 'post-1',
        status: ContentReportStatus.PENDING,
        post: { id: 'post-1', title: 'Test post' },
      });
      prisma.contentReport.findMany.mockResolvedValue([
        { id: 'report-2', reason: 'SPAM', status: ContentReportStatus.PENDING, createdAt: new Date() },
      ]);

      const result = await service.getContentReport('report-1');

      expect(prisma.contentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { postId: 'post-1', id: { not: 'report-1' } } }),
      );
      expect(result.otherReportsOnPost).toHaveLength(1);
    });

    it('throws NotFoundException for an unknown report', async () => {
      prisma.contentReport.findUnique.mockResolvedValue(null);
      await expect(service.getContentReport('missing')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('AdminService — organizations', () => {
  let service: AdminService;
  let prisma: { organization: { count: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      organization: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('listOrganizations', () => {
    it('always excludes the internal SYSTEM placeholder org', async () => {
      await service.listOrganizations({ page: 1, limit: 20 });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { type: { not: 'SYSTEM' } },
      });
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: { not: 'SYSTEM' } } }),
      );
    });

    it('ignores an explicit request to filter by SYSTEM type', async () => {
      await service.listOrganizations({ page: 1, limit: 20, type: 'SYSTEM' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { type: { not: 'SYSTEM' } },
      });
    });

    it('still applies a real type filter', async () => {
      await service.listOrganizations({ page: 1, limit: 20, type: 'HOSPITAL' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({ where: { type: 'HOSPITAL' } });
    });
  });
});
