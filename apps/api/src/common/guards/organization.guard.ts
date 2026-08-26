import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizationStatus, RoleCode } from '@prisma/client';
import { RequestUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';

/**
 * Every org-scoped route in this API names its path param `:organizationId`
 * (confirmed across every controller - none use a different name), so this
 * guard reads that param directly rather than requiring per-route metadata.
 * A route without an `:organizationId` param is untouched (this guard is a
 * no-op for it) - org-scoped access control for those stays wherever it
 * already lives (e.g. courier and donor-facing routes resolve their
 * organization from a resource id in the body/URL, not the URL itself).
 *
 * `@Roles(...)` only checks role codes present anywhere on the user's JWT,
 * not which organization they were granted that role in - so without this
 * guard, staff of one hospital could pass HOSPITAL_STAFF's role check and
 * act on a *different* hospital's `:organizationId` for any route whose
 * service doesn't separately re-verify membership itself. This guard closes
 * that gap centrally instead of relying on every service to remember to.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId: string | undefined = request.params?.organizationId;
    if (!organizationId) return true;

    const user = request.user as RequestUser | undefined;
    if (!user?.sub) {
      throw new ForbiddenException('Access denied.');
    }

    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: user.sub, status: 'ACTIVE' },
      include: { role: true, organization: true },
    });

    // Super admins manage organizations regardless of membership or status.
    if (memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN)) {
      return true;
    }

    const membership = memberships.find((m) => m.organizationId === organizationId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization.');
    }

    if (membership.organization.status !== OrganizationStatus.ACTIVE) {
      throw new ForbiddenException('This organization is not active.');
    }

    return true;
  }
}
