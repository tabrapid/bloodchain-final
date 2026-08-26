import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrganizationStatus, RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationGuard } from './organization.guard';

function createContext(userId: string | undefined, organizationId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { sub: userId } : undefined,
        params: organizationId ? { organizationId } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;
  let prisma: { organizationMembership: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { organizationMembership: { findMany: jest.fn() } };
    guard = new OrganizationGuard(prisma as unknown as PrismaService);
  });

  it('allows access without touching the database when the route has no :organizationId param', async () => {
    await expect(guard.canActivate(createContext('user-1', undefined))).resolves.toBe(true);
    expect(prisma.organizationMembership.findMany).not.toHaveBeenCalled();
  });

  it('denies access when there is no authenticated user on an org-scoped route', async () => {
    await expect(guard.canActivate(createContext(undefined, 'org-1'))).rejects.toThrow(ForbiddenException);
  });

  it('allows access for an ACTIVE member of the requested organization when it is ACTIVE', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { code: RoleCode.HOSPITAL_STAFF }, organization: { status: OrganizationStatus.ACTIVE } },
    ]);

    await expect(guard.canActivate(createContext('user-1', 'org-1'))).resolves.toBe(true);
  });

  it('denies access for a staff member of a *different* organization than the one requested', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      { organizationId: 'org-2', role: { code: RoleCode.HOSPITAL_STAFF }, organization: { status: OrganizationStatus.ACTIVE } },
    ]);

    await expect(guard.canActivate(createContext('user-1', 'org-1'))).rejects.toThrow(ForbiddenException);
  });

  it('denies access when the user has no memberships at all', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect(guard.canActivate(createContext('user-1', 'org-1'))).rejects.toThrow(ForbiddenException);
  });

  it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
    'denies a real member when their organization is %s',
    async (status) => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: 'org-1', role: { code: RoleCode.HOSPITAL_ADMIN }, organization: { status } },
      ]);

      await expect(guard.canActivate(createContext('user-1', 'org-1'))).rejects.toThrow(ForbiddenException);
    },
  );

  it('allows a super admin into any organization regardless of membership or status', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      { organizationId: 'org-99', role: { code: RoleCode.SUPER_ADMIN }, organization: { status: OrganizationStatus.ACTIVE } },
    ]);

    await expect(guard.canActivate(createContext('admin-1', 'org-1'))).resolves.toBe(true);
  });
});
