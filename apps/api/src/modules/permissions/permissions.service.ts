import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RoleCode } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private readonly db: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const permissions = new Set<string>();
    for (const membership of memberships) {
      for (const rp of membership.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    if (memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN)) {
      permissions.add('admin.manage');
    }

    return Array.from(permissions);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async hasAnyPermission(userId: string, permissionList: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionList.some((p) => permissions.includes(p));
  }

  async hasAllPermissions(userId: string, permissionList: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionList.every((p) => permissions.includes(p));
  }
}
