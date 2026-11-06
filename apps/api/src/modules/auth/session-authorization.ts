import { UnauthorizedException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Shared by HTTP and WebSocket paths after cryptographic JWT verification. */
export async function resolveSessionUser(
  db: PrismaService,
  payload: { sub?: unknown; sid?: unknown },
) {
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.sid !== 'string' ||
    !payload.sid
  ) {
    throw new UnauthorizedException('Session expired. Please sign in again.');
  }
  const session = await db.session.findUnique({
    where: { id: payload.sid },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: {
              organization: { select: { status: true } },
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      },
    },
  });
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status === 'SUSPENDED' ||
    session.user.status === 'DEACTIVATED'
  ) {
    throw new UnauthorizedException('Session expired. Please sign in again.');
  }
  // Signed claims describe issuance time. Authorization uses current grants,
  // including organization suspension and role/permission removal.
  const memberships = session.user.memberships.filter(
    (m) => m.role.code === RoleCode.SUPER_ADMIN || m.organization.status === 'ACTIVE',
  );
  const roles = [...new Set(memberships.map((m) => m.role.code))];
  const permissions = new Set(
    memberships.flatMap((m) => m.role.permissions.map((grant) => grant.permission.code)),
  );
  if (roles.includes(RoleCode.SUPER_ADMIN)) permissions.add('admin.manage');
  return {
    sub: payload.sub,
    roles,
    permissions: [...permissions],
    sid: payload.sid,
  };
}
