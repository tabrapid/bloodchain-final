import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { RoleCode } from '@prisma/client';

export const ORGANIZATION_ID_KEY = 'organizationId';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const orgIdParam = this.reflector.getAllAndOverride<string>(ORGANIZATION_ID_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!orgIdParam) return true;

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user?.sub) throw new ForbiddenException('Access denied.');

    const request = context.switchToHttp().getRequest();
    const requestedOrgId = request.params[orgIdParam];

    if (!requestedOrgId) return true;

    const membership = await this.db.organizationMembership.findFirst({
      where: {
        userId: user.sub,
        organizationId: requestedOrgId,
        status: 'ACTIVE',
        role: { code: { in: [RoleCode.SUPER_ADMIN] } },
      },
    });

    if (membership) return true;

    const userMemberships = await this.db.organizationMembership.findMany({
      where: { userId: user.sub, status: 'ACTIVE' },
      include: { role: true },
    });

    const isMemberOfRequestedOrg = userMemberships.some((m) => m.organizationId === requestedOrgId);

    if (!isMemberOfRequestedOrg) {
      throw new ForbiddenException('You do not have access to this organization.');
    }

    return true;
  }
}
