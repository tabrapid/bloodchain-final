import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  UserStatus,
  OrganizationStatus,
  OrganizationType,
  RoleCode,
  CourierStatus,
  ShipmentStatus,
  BloodRequestStatus,
  EmergencyStatus,
  ContentReportStatus,
  ContentReportReason,
  CommunityPostStatus,
  Prisma,
} from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async getPlatformStats(startDate?: Date, endDate?: Date): Promise<any> {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [
      totalUsers,
      activeUsers,
      verifiedDonors,
      hospitals,
      bloodCenters,
      couriers,
      activeRequests,
      criticalRequests,
      activeEmergencies,
      activeShipments,
      pendingOrganizations,
      suspendedOrganizations,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.db.donorProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.db.organization.count({ where: { type: OrganizationType.HOSPITAL } }),
      this.db.organization.count({ where: { type: OrganizationType.BLOOD_CENTER } }),
      this.db.courier.count(),
      this.db.bloodRequest.count({
        where: {
          status: { in: [BloodRequestStatus.SUBMITTED, BloodRequestStatus.UNDER_REVIEW, BloodRequestStatus.APPROVED] },
        },
      }),
      this.db.bloodRequest.count({ where: { priority: 'CRITICAL', status: { not: BloodRequestStatus.DELIVERED } } }),
      this.db.emergencyRequest.count({ where: { status: { in: [EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING] } } }),
      this.db.shipment.count({
        where: {
          status: {
            in: [
              ShipmentStatus.CREATED,
              ShipmentStatus.COURIER_ASSIGNED,
              ShipmentStatus.COURIER_ACCEPTED,
              ShipmentStatus.PICKUP_STARTED,
              ShipmentStatus.PICKED_UP,
              ShipmentStatus.IN_TRANSIT,
              ShipmentStatus.ARRIVED_AT_HOSPITAL,
            ],
          },
        },
      }),
      this.db.organization.count({ where: { status: OrganizationStatus.PENDING_APPROVAL } }),
      this.db.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayDonations,
      todayAppointments,
      todayBloodTests,
      lowStockAlerts,
      criticalStockAlerts,
    ] = await Promise.all([
      this.db.donation.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: { in: ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS'] },
        },
      }),
      this.db.appointment.count({
        where: {
          scheduledStart: { gte: today, lt: tomorrow },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      }),
      this.db.laboratoryResult.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.db.inventoryAlert.count({
        where: { type: 'LOW_STOCK', acknowledged: false },
      }),
      this.db.inventoryAlert.count({
        where: { type: 'LOW_STOCK', acknowledged: false },
      }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, verifiedDonors: verifiedDonors },
      organizations: {
        hospitals: hospitals,
        bloodCenters: bloodCenters,
        pending: pendingOrganizations,
        suspended: suspendedOrganizations,
      },
      couriers: couriers,
      bloodRequests: {
        active: activeRequests,
        critical: criticalRequests,
      },
      emergencies: { active: activeEmergencies },
      shipments: { active: activeShipments },
      todayActivity: {
        donations: todayDonations,
        appointments: todayAppointments,
        bloodTests: todayBloodTests,
      },
      alerts: {
        lowStock: lowStockAlerts,
        criticalStock: criticalStockAlerts,
      },
    };
  }

  async listUsers(input: {
    page: number;
    limit: number;
    role?: RoleCode;
    status?: UserStatus;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, role, status, organizationId, startDate, endDate, search } = input;

    const where: Prisma.UserWhereInput = {};

    if (status) where.status = status;
    if (role) {
      where.memberships = {
        some: { role: { code: role } },
      };
    }
    if (organizationId) {
      where.memberships = {
        some: { organizationId },
      };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            include: {
              role: true,
              organization: { select: { id: true, name: true, type: true } },
            },
          },
          donorProfile: { select: { bloodType: true, rhFactor: true, donorStatus: true } },
        },
      }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        phone: u.phone,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        roles: u.memberships.map((m) => ({
          membershipId: m.id,
          role: m.role.code,
          organization: m.organization,
        })),
        bloodType: u.donorProfile?.bloodType,
        rhFactor: u.donorProfile?.rhFactor,
        donorStatus: u.donorProfile?.donorStatus,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(userId: string): Promise<any> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            role: true,
            organization: { select: { id: true, name: true, type: true, status: true } },
          },
        },
        donorProfile: { select: { bloodType: true, rhFactor: true, donorStatus: true, verificationStatus: true, dateOfBirth: true } },
        auditLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { id: true, action: true, entityType: true, createdAt: true, ipAddress: true },
        },
        refreshTokens: { take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, expiresAt: true, revokedAt: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      roles: user.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role.code,
        organization: m.organization,
        status: m.status,
      })),
      donorProfile: user.donorProfile,
      recentAuditLogs: user.auditLogs,
      activeSessions: user.refreshTokens.filter((t) => !t.revokedAt),
    };
  }

  async suspendUser(adminId: string, userId: string, reason?: string, expiresAt?: Date): Promise<any> {
    if (adminId === userId) throw new BadRequestException('Cannot suspend yourself');

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === UserStatus.SUSPENDED) throw new BadRequestException('User is already suspended');

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_SUSPENDED',
        entityType: 'User',
        entityId: userId,
        metadata: { reason, expiresAt: expiresAt?.toISOString() },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async restoreUser(adminId: string, userId: string): Promise<any> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.SUSPENDED) throw new BadRequestException('User is not suspended');

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_RESTORED',
        entityType: 'User',
        entityId: userId,
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async listRoles(): Promise<any[]> {
    const roles = await this.db.role.findMany({
      orderBy: { code: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      permissions: role.permissions.map((rp) => rp.permission.code).sort(),
    }));
  }

  async listPermissions(): Promise<any[]> {
    const permissions = await this.db.permission.findMany({ orderBy: { code: 'asc' } });
    return permissions.map((p) => ({ id: p.id, code: p.code, name: p.name }));
  }

  async updateRolePermissions(
    adminId: string,
    roleId: string,
    permissionCodes: string[],
  ): Promise<any> {
    const role = await this.db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    if (role.code === RoleCode.SUPER_ADMIN) {
      throw new BadRequestException(
        'SUPER_ADMIN permissions cannot be edited — its platform access is enforced by role, not the permission matrix.',
      );
    }

    const uniqueCodes = Array.from(new Set(permissionCodes));
    const permissions = await this.db.permission.findMany({
      where: { code: { in: uniqueCodes } },
    });
    const foundCodes = new Set(permissions.map((p) => p.code));
    const unknownCodes = uniqueCodes.filter((code) => !foundCodes.has(code));
    if (unknownCodes.length > 0) {
      throw new BadRequestException(`Unknown permission code(s): ${unknownCodes.join(', ')}`);
    }

    await this.db.$transaction([
      this.db.rolePermission.deleteMany({ where: { roleId } }),
      this.db.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entityType: 'Role',
        entityId: roleId,
        metadata: { roleCode: role.code, permissionCodes: uniqueCodes },
      },
    });

    return { id: role.id, code: role.code, permissions: uniqueCodes.sort() };
  }

  async updateMembershipRole(adminId: string, membershipId: string, roleId: string): Promise<any> {
    const membership = await this.db.organizationMembership.findUnique({
      where: { id: membershipId },
      include: { role: true, organization: { select: { id: true, name: true } } },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const newRole = await this.db.role.findUnique({ where: { id: roleId } });
    if (!newRole) throw new NotFoundException('Role not found');

    if (membership.roleId === roleId) {
      return {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: newRole.code,
      };
    }

    const updated = await this.db.organizationMembership.update({
      where: { id: membershipId },
      data: { roleId },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'MEMBERSHIP_ROLE_CHANGED',
        entityType: 'OrganizationMembership',
        entityId: membershipId,
        organizationId: membership.organizationId,
        metadata: {
          userId: membership.userId,
          fromRole: membership.role.code,
          toRole: newRole.code,
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      organizationId: updated.organizationId,
      role: newRole.code,
    };
  }

  async listOrganizations(input: {
    page: number;
    limit: number;
    type?: OrganizationType;
    status?: OrganizationStatus;
    search?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, type, status, search } = input;

    // SYSTEM is an internal placeholder org (donor accounts' required FK
    // target), not a real organization to manage — exclude it here.
    const where: Prisma.OrganizationWhereInput = { type: { not: OrganizationType.SYSTEM } };
    if (type && type !== OrganizationType.SYSTEM) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, organizations] = await Promise.all([
      this.db.organization.count({ where }),
      this.db.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: { where: { status: 'ACTIVE' }, select: { userId: true } },
        },
      }),
    ]);

    return {
      data: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        status: o.status,
        email: o.email,
        phone: o.phone,
        address: o.address,
        createdAt: o.createdAt,
        staffCount: o.memberships.length,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrganization(orgId: string): Promise<any> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      include: {
        hospital: true,
        bloodCenter: true,
        memberships: {
          include: { role: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        _count: {
          select: {
            bloodRequestsRequested: true,
            bloodRequestsFulfilled: true,
            shipmentsSource: true,
            shipmentsDestination: true,
            couriers: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');

    return {
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      email: org.email,
      phone: org.phone,
      address: org.address,
      latitude: org.latitude,
      longitude: org.longitude,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      staff: org.memberships.map((m) => ({
        userId: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role.code,
      })),
      stats: {
        bloodRequestsReceived: org._count.bloodRequestsRequested,
        bloodRequestsFulfilled: org._count.bloodRequestsFulfilled,
        shipmentsCreated: org._count.shipmentsSource,
        shipmentsReceived: org._count.shipmentsDestination,
        couriers: org._count.couriers,
      },
    };
  }

  async verifyOrganization(adminId: string, orgId: string, notes?: string): Promise<any> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== OrganizationStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Organization is not pending approval');
    }

    const updated = await this.db.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ORGANIZATION_VERIFIED',
        entityType: 'Organization',
        entityId: orgId,
        metadata: { notes },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async rejectOrganization(adminId: string, orgId: string, reason: string): Promise<any> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== OrganizationStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Organization is not pending approval');
    }

    const updated = await this.db.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.DEACTIVATED },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ORGANIZATION_REJECTED',
        entityType: 'Organization',
        entityId: orgId,
        metadata: { reason },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async suspendOrganization(adminId: string, orgId: string, reason?: string): Promise<any> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status === OrganizationStatus.SUSPENDED) throw new BadRequestException('Organization is already suspended');

    const updated = await this.db.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.SUSPENDED },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ORGANIZATION_SUSPENDED',
        entityType: 'Organization',
        entityId: orgId,
        metadata: { reason },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async restoreOrganization(adminId: string, orgId: string): Promise<any> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== OrganizationStatus.SUSPENDED) {
      throw new BadRequestException('Organization is not suspended');
    }

    const updated = await this.db.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ORGANIZATION_RESTORED',
        entityType: 'Organization',
        entityId: orgId,
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async listCouriers(input: {
    page: number;
    limit: number;
    status?: CourierStatus;
    organizationId?: string;
    search?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, status, organizationId, search } = input;

    const where: Prisma.CourierWhereInput = {};
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, couriers] = await Promise.all([
      this.db.courier.count({ where }),
      this.db.courier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, lastLoginAt: true } },
          _count: { select: { shipments: true } },
        },
      }),
    ]);

    return {
      data: couriers.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        phone: c.phone,
        status: c.status,
        createdAt: c.createdAt,
        lastLoginAt: c.user.lastLoginAt,
        organization: c.organization,
        totalShipments: c._count.shipments,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCourier(courierId: string): Promise<any> {
    const courier = await this.db.courier.findUnique({
      where: { id: courierId },
      include: {
        organization: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true, lastLoginAt: true } },
        shipments: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            shipmentReference: true,
            status: true,
            createdAt: true,
            deliveredAt: true,
            failedAt: true,
          },
        },
        _count: { select: { shipments: true } },
      },
    });

    if (!courier) throw new NotFoundException('Courier not found');

    const completedShipments = courier.shipments.filter((s) => s.status === ShipmentStatus.DELIVERED).length;
    const failedShipments = courier.shipments.filter((s) => s.status === ShipmentStatus.FAILED).length;

    return {
      id: courier.id,
      displayName: courier.displayName,
      phone: courier.phone,
      status: courier.status,
      createdAt: courier.createdAt,
      organization: courier.organization,
      user: courier.user,
      stats: {
        totalShipments: courier._count.shipments,
        completedShipments,
        failedShipments,
      },
      recentShipments: courier.shipments,
    };
  }

  async suspendCourier(adminId: string, courierId: string, reason?: string): Promise<any> {
    const courier = await this.db.courier.findUnique({ where: { id: courierId } });
    if (!courier) throw new NotFoundException('Courier not found');
    if (courier.status === CourierStatus.SUSPENDED) throw new BadRequestException('Courier is already suspended');

    const updated = await this.db.courier.update({
      where: { id: courierId },
      data: { status: CourierStatus.SUSPENDED },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'COURIER_SUSPENDED',
        entityType: 'Courier',
        entityId: courierId,
        metadata: { reason },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async restoreCourier(adminId: string, courierId: string): Promise<any> {
    const courier = await this.db.courier.findUnique({ where: { id: courierId } });
    if (!courier) throw new NotFoundException('Courier not found');
    if (courier.status !== CourierStatus.SUSPENDED) throw new BadRequestException('Courier is not suspended');

    const updated = await this.db.courier.update({
      where: { id: courierId },
      data: { status: CourierStatus.OFFLINE },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'COURIER_RESTORED',
        entityType: 'Courier',
        entityId: courierId,
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async search(query: string, type?: string, page = 1, limit = 20): Promise<PaginatedResult<any>> {
    const searchQuery = query.length < 2 ? query : query.slice(0, 50);
    const results: any[] = [];
    let total = 0;

    if (!type || type === 'users') {
      const users = await this.db.user.findMany({
        where: {
          OR: [
            { email: { contains: searchQuery, mode: 'insensitive' } },
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          memberships: { include: { role: true, organization: { select: { name: true, type: true } } } },
        },
      });
      results.push(...users.map((u) => ({ type: 'user', id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, status: u.status, roles: u.memberships.map((m) => m.role.code) })));
    }

    if (!type || type === 'organizations') {
      const orgs = await this.db.organization.findMany({
        where: {
          type: { not: OrganizationType.SYSTEM },
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: { id: true, name: true, type: true, status: true, createdAt: true },
      });
      results.push(...orgs.map((o) => ({ type: 'organization', id: o.id, name: o.name, subtype: o.type, status: o.status })));
    }

    if (!type || type === 'couriers') {
      const couriers = await this.db.courier.findMany({
        where: {
          OR: [
            { displayName: { contains: searchQuery, mode: 'insensitive' } },
            { phone: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: { id: true, displayName: true, phone: true, status: true, organization: { select: { name: true } } },
      });
      results.push(...couriers.map((c) => ({ type: 'courier', id: c.id, name: c.displayName, phone: c.phone, status: c.status, organization: c.organization?.name })));
    }

    if (!type || type === 'shipments') {
      const shipments = await this.db.shipment.findMany({
        where: { shipmentReference: { contains: searchQuery.toUpperCase(), mode: 'insensitive' } },
        take: limit,
        select: { id: true, shipmentReference: true, status: true, createdAt: true },
      });
      results.push(...shipments.map((s) => ({ type: 'shipment', id: s.id, reference: s.shipmentReference, status: s.status })));
    }

    if (!type || type === 'requests') {
      const requests = await this.db.bloodRequest.findMany({
        where: { requestReference: { contains: searchQuery.toUpperCase(), mode: 'insensitive' } },
        take: limit,
        select: { id: true, requestReference: true, status: true, priority: true, createdAt: true },
      });
      results.push(...requests.map((r) => ({ type: 'blood_request', id: r.id, reference: r.requestReference, status: r.status, priority: r.priority })));
    }

    return {
      data: results,
      meta: { total: results.length, page, limit, totalPages: Math.ceil(results.length / limit) },
    };
  }

  async listAuditLogs(input: {
    page: number;
    limit: number;
    actorId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    result?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, actorId, action, entityType, startDate, endDate } = input;

    const where: Prisma.AuditLogWhereInput = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, logs] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
        actor: l.actor ? { id: l.actor.id, name: `${l.actor.firstName} ${l.actor.lastName}`, email: l.actor.email } : null,
        organization: l.organization,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listShipments(input: {
    page: number;
    limit: number;
    status?: ShipmentStatus;
    priority?: string;
    sourceOrganizationId?: string;
    destinationOrganizationId?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, status, priority, sourceOrganizationId, destinationOrganizationId } = input;

    const where: Prisma.ShipmentWhereInput = {};
    if (status) where.status = status;
    if (sourceOrganizationId) where.sourceOrganizationId = sourceOrganizationId;
    if (destinationOrganizationId) where.destinationOrganizationId = destinationOrganizationId;

    const [total, shipments] = await Promise.all([
      this.db.shipment.count({ where }),
      this.db.shipment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bloodRequest: { select: { id: true, requestReference: true, priority: true } },
          sourceOrganization: { select: { id: true, name: true } },
          destinationOrganization: { select: { id: true, name: true } },
          courier: { select: { id: true, displayName: true, phone: true } },
          _count: { select: { units: true } },
        },
      }),
    ]);

    return {
      data: shipments.map((s) => ({
        id: s.id,
        shipmentReference: s.shipmentReference,
        status: s.status,
        createdAt: s.createdAt,
        pickedUpAt: s.pickedUpAt,
        deliveredAt: s.deliveredAt,
        bloodRequest: s.bloodRequest,
        source: s.sourceOrganization,
        destination: s.destinationOrganization,
        courier: s.courier,
        unitsCount: s._count.units,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getShipment(shipmentId: string): Promise<any> {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: {
          include: {
            requestingOrganization: { select: { id: true, name: true } },
            fulfillingOrganization: { select: { id: true, name: true } },
          },
        },
        sourceOrganization: true,
        destinationOrganization: true,
        courier: {
          include: { organization: { select: { id: true, name: true } } },
        },
        units: {
          include: { bloodUnit: { select: { id: true, bloodType: true, rhFactor: true, componentType: true } } },
        },
        events: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    return {
      id: shipment.id,
      shipmentReference: shipment.shipmentReference,
      status: shipment.status,
      createdAt: shipment.createdAt,
      pickedUpAt: shipment.pickedUpAt,
      deliveredAt: shipment.deliveredAt,
      bloodRequest: shipment.bloodRequest,
      source: shipment.sourceOrganization,
      destination: shipment.destinationOrganization,
      courier: shipment.courier,
      units: shipment.units.map((u) => ({
        id: u.id,
        status: u.status,
        bloodUnit: u.bloodUnit,
      })),
      timeline: shipment.events,
    };
  }

  async listBloodRequests(input: {
    page: number;
    limit: number;
    status?: BloodRequestStatus;
    priority?: string;
    bloodType?: string;
    organizationId?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, status, priority, bloodType, organizationId } = input;

    const where: Prisma.BloodRequestWhereInput = {};
    if (status) where.status = status;
    if (priority) where.priority = priority as any;
    if (organizationId) {
      where.OR = [
        { requestingOrganizationId: organizationId },
        { fulfillingOrganizationId: organizationId },
      ];
    }

    const [total, requests] = await Promise.all([
      this.db.bloodRequest.count({ where }),
      this.db.bloodRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestingOrganization: { select: { id: true, name: true } },
          fulfillingOrganization: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      data: requests.map((r) => ({
        id: r.id,
        requestReference: r.requestReference,
        status: r.status,
        priority: r.priority,
        createdAt: r.createdAt,
        expectedDeliveryDate: r.expectedDeliveryDate,
        requestingOrganization: r.requestingOrganization,
        fulfillingOrganization: r.fulfillingOrganization,
        itemsCount: r._count.items,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listEmergencies(input: {
    page: number;
    limit: number;
    status?: EmergencyStatus;
    bloodType?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, status, bloodType } = input;

    const where: Prisma.EmergencyRequestWhereInput = {};
    if (status) where.status = status;
    if (bloodType) where.bloodType = bloodType as any;

    const [total, emergencies] = await Promise.all([
      this.db.emergencyRequest.count({ where }),
      this.db.emergencyRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hospital: { select: { id: true, name: true, address: true } },
          _count: { select: { responses: true } },
        },
      }),
    ]);

    return {
      data: emergencies.map((e) => ({
        id: e.id,
        bloodType: e.bloodType,
        rhFactor: e.rhFactor,
        unitsRequired: e.unitsRequired,
        unitsCollected: e.unitsCollected,
        status: e.status,
        createdAt: e.createdAt,
        requiredBefore: e.requiredBefore,
        hospital: e.hospital,
        responseCount: e._count.responses,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getInventoryOverview(): Promise<any> {
    const byBloodGroup = await this.db.bloodUnit.groupBy({
      by: ['bloodType', 'rhFactor', 'status'],
      _count: { id: true },
    });

    const summary = byBloodGroup.reduce(
      (acc, b) => {
        const key = `${b.bloodType}${b.rhFactor}`;
        if (!acc[key]) acc[key] = { total: 0, available: 0, reserved: 0 };
        acc[key].total += b._count.id;
        if (b.status === 'AVAILABLE') acc[key].available += b._count.id;
        if (b.status === 'RESERVED') acc[key].reserved += b._count.id;
        return acc;
      },
      {} as Record<string, { total: number; available: number; reserved: number }>,
    );

    const lowStock = await this.db.inventoryAlert.findMany({
      where: { type: 'LOW_STOCK', acknowledged: false },
      include: {
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { byBloodGroup: summary, lowStockAlerts: lowStock };
  }

  async listAlerts(input: {
    page: number;
    limit: number;
    severity?: string;
    category?: string;
    acknowledged?: boolean;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, category, acknowledged } = input;

    const where: Prisma.InventoryAlertWhereInput = {};
    if (category) where.type = category as any;
    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged;
    }

    const [total, alerts] = await Promise.all([
      this.db.inventoryAlert.count({ where }),
      this.db.inventoryAlert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        bloodType: a.bloodType,
        rhFactor: a.rhFactor,
        message: a.message,
        threshold: a.threshold,
        currentValue: a.currentValue,
        createdAt: a.createdAt,
        acknowledged: a.acknowledged,
        acknowledgedAt: a.acknowledgedAt,
        organization: a.organization,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async acknowledgeAlert(adminId: string, alertId: string, notes?: string): Promise<any> {
    const alert = await this.db.inventoryAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');

    const updated = await this.db.inventoryAlert.update({
      where: { id: alertId },
      data: { acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: adminId },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ALERT_ACKNOWLEDGED',
        entityType: 'InventoryAlert',
        entityId: alertId,
        metadata: { notes },
      },
    });

    return updated;
  }

  async listContentReports(input: {
    page: number;
    limit: number;
    status?: ContentReportStatus;
    reason?: ContentReportReason;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, status, reason } = input;

    const where: Prisma.ContentReportWhereInput = {};
    if (status) where.status = status;
    if (reason) where.reason = reason;

    const [total, reports] = await Promise.all([
      this.db.contentReport.count({ where }),
      this.db.contentReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          post: { select: { id: true, type: true, title: true, body: true, status: true } },
          reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return {
      data: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        resolution: r.resolution,
        post: r.post,
        reporter: r.reporter,
        reviewer: r.reviewer,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getContentReport(reportId: string): Promise<any> {
    const report = await this.db.contentReport.findUnique({
      where: { id: reportId },
      include: {
        post: {
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            imageUrl: true,
            status: true,
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!report) throw new NotFoundException('Content report not found');

    const otherReports = await this.db.contentReport.findMany({
      where: { postId: report.postId, id: { not: reportId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reason: true, status: true, createdAt: true },
    });

    return { ...report, otherReportsOnPost: otherReports };
  }

  async resolveContentReport(
    adminId: string,
    reportId: string,
    action: 'DISMISS' | 'HIDE' | 'REMOVE',
    resolution?: string,
  ): Promise<any> {
    const report = await this.db.contentReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Content report not found');
    if (report.status === ContentReportStatus.DISMISSED || report.status === ContentReportStatus.ACTIONED) {
      throw new BadRequestException('This report has already been resolved.');
    }

    const now = new Date();
    const newStatus =
      action === 'DISMISS' ? ContentReportStatus.DISMISSED : ContentReportStatus.ACTIONED;

    const [updatedReport] = await this.db.$transaction([
      this.db.contentReport.update({
        where: { id: reportId },
        data: { status: newStatus, reviewedBy: adminId, reviewedAt: now, resolution },
      }),
      ...(action === 'HIDE' || action === 'REMOVE'
        ? [
            this.db.communityPost.update({
              where: { id: report.postId },
              data: { status: action === 'HIDE' ? CommunityPostStatus.HIDDEN : CommunityPostStatus.REMOVED },
            }),
            // Resolving the post also closes out every other still-open report
            // against it, so actioning one doesn't leave duplicate reports
            // sitting in the queue forever for a post that's already gone.
            this.db.contentReport.updateMany({
              where: {
                postId: report.postId,
                id: { not: reportId },
                status: { in: [ContentReportStatus.PENDING, ContentReportStatus.REVIEWED] },
              },
              data: {
                status: ContentReportStatus.ACTIONED,
                reviewedBy: adminId,
                reviewedAt: now,
                resolution: `Auto-resolved: post ${action === 'HIDE' ? 'hidden' : 'removed'} via report ${reportId}.`,
              },
            }),
          ]
        : []),
    ]);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'CONTENT_REPORT_RESOLVED',
        entityType: 'ContentReport',
        entityId: reportId,
        metadata: { action, resolution, postId: report.postId },
      },
    });

    return updatedReport;
  }

  async getSystemHealth(): Promise<any> {
    let databaseStatus: 'up' | 'down' = 'up';
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'down';
    }

    const [
      pendingOrganizations,
      pendingCouriers,
      activeAlerts,
      failedJobs,
    ] = await Promise.all([
      this.db.organization.count({ where: { status: OrganizationStatus.PENDING_APPROVAL } }),
      this.db.courier.count({ where: { status: CourierStatus.OFFLINE } }),
      this.db.inventoryAlert.count({ where: { acknowledgedAt: null } }),
      this.db.auditLog.count({
        where: {
          action: 'JOB_FAILED',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      status: databaseStatus === 'up' ? 'healthy' : 'degraded',
      database: databaseStatus,
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      pending: {
        organizations: pendingOrganizations,
        couriers: pendingCouriers,
      },
      alerts: activeAlerts,
      recentErrors: failedJobs,
    };
  }

  async getActivityFeed(limit = 50, offset = 0): Promise<any[]> {
    const auditLogs = await this.db.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      where: { action: { not: 'LOGIN' } },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    return auditLogs.map((l) => ({
      id: l.id,
      type: 'audit',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      actor: l.actor ? { id: l.actor.id, name: `${l.actor.firstName} ${l.actor.lastName}` } : null,
      organization: l.organization,
    }));
  }
}
