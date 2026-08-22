import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BloodRequestStatus,
  CourierStatus,
  DeliveryFailureReason,
  MovementType,
  OrganizationType,
  Prisma,
  ReservationStatus,
  RoleCode,
  ShipmentEventType,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Courier, Organization, User } from '@prisma/client';

type OrganizationWithType = Organization & { __typename?: string };

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  private generateShipmentReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `SHP-${year}-${random}`;
  }

  private generateRequestReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `REQ-${year}-${random}`;
  }

  async getAuthorizedUser(userId: string, organizationId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            role: true,
          },
        },
        courier: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const membership = user.memberships.find(
      (m: { organizationId: string; status: string }) => m.organizationId === organizationId && m.status === 'ACTIVE',
    );

    if (!membership) {
      throw new ForbiddenException('You do not belong to this organization.');
    }

    return { user, membership };
  }

  async checkBloodCenterAccess(userId: string, organizationId: string) {
    const { user, membership } = await this.getAuthorizedUser(userId, organizationId);
    const org = await this.db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.type !== OrganizationType.BLOOD_CENTER) {
      throw new ForbiddenException('Only blood centers can perform this action.');
    }
    const hasPermission = user.memberships.some(
      (m: { role: { code: string } }) =>
        ['BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF', 'SUPER_ADMIN'].includes(m.role.code),
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return { user, membership };
  }

  async checkHospitalAccess(userId: string, organizationId: string) {
    const { user, membership } = await this.getAuthorizedUser(userId, organizationId);
    const org = await this.db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.type !== OrganizationType.HOSPITAL) {
      throw new ForbiddenException('Only hospitals can perform this action.');
    }
    const hasPermission = user.memberships.some(
      (m: { role: { code: string } }) =>
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN'].includes(m.role.code),
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return { user, membership };
  }

  async checkCourierAccess(userId: string) {
    const courier = await this.db.courier.findUnique({
      where: { userId },
      include: { user: true, organization: true },
    });
    if (!courier) {
      throw new ForbiddenException('Courier profile not found.');
    }
    return courier;
  }

  async createRequest(
    organizationId: string,
    userId: string,
    dto: {
      items: Array<{
        bloodType: string;
        rhFactor: string;
        componentType?: string;
        unitsRequested: number;
      }>;
      priority?: string;
      notes?: string;
      deliveryAddress?: string;
      deliveryLatitude?: number;
      deliveryLongitude?: number;
      deliveryPhone?: string;
      expectedDeliveryDate?: string;
    },
  ) {
    const { user } = await this.checkHospitalAccess(userId, organizationId);

    const result = await this.db.$transaction(async (tx) => {
      const request = await tx.bloodRequest.create({
        data: {
          requestReference: this.generateRequestReference(),
          requestingOrganizationId: organizationId,
          priority: (dto.priority as any) || 'ROUTINE',
          status: BloodRequestStatus.SUBMITTED,
          notes: dto.notes,
          deliveryAddress: dto.deliveryAddress,
          deliveryLatitude: dto.deliveryLatitude ? new Prisma.Decimal(dto.deliveryLatitude) : undefined,
          deliveryLongitude: dto.deliveryLongitude ? new Prisma.Decimal(dto.deliveryLongitude) : undefined,
          deliveryPhone: dto.deliveryPhone,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
        },
      });

      for (const item of dto.items) {
        await tx.bloodRequestItem.create({
          data: {
            bloodRequestId: request.id,
            bloodType: item.bloodType as any,
            rhFactor: item.rhFactor as any,
            componentType: (item.componentType as any) || 'WHOLE_BLOOD',
            unitsRequested: item.unitsRequested,
          },
        });
      }

      await tx.bloodRequestEvent.create({
        data: {
          bloodRequestId: request.id,
          eventType: 'SUBMITTED',
          actorId: user.id,
          organizationId,
          metadata: { items: dto.items.length },
        },
      });

      return request;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'BLOOD_REQUEST_CREATED',
      entityType: 'BloodRequest',
      entityId: result.id,
      organizationId,
      metadata: { requestReference: result.requestReference, priority: dto.priority },
    });

    return result;
  }

  async getRequests(
    organizationId: string,
    userId: string,
    filters: {
      status?: string;
      priority?: string;
      type?: 'requesting' | 'fulfilling';
    },
  ) {
    await this.getAuthorizedUser(userId, organizationId);
    const org = await this.db.organization.findUnique({ where: { id: organizationId } });

    const where: Prisma.BloodRequestWhereInput = {};
    if (filters.type === 'requesting' || (org && org.type === OrganizationType.HOSPITAL)) {
      where.requestingOrganizationId = organizationId;
    } else if (filters.type === 'fulfilling' || (org && org.type === OrganizationType.BLOOD_CENTER)) {
      where.fulfillingOrganizationId = organizationId;
    }
    if (filters.status) where.status = filters.status as BloodRequestStatus;
    if (filters.priority) where.priority = filters.priority as any;

    const requests = await this.db.bloodRequest.findMany({
      where,
      include: {
        items: true,
        requestingOrganization: { select: { id: true, name: true } },
        fulfillingOrganization: { select: { id: true, name: true } },
        shipment: { select: { id: true, status: true, courier: { select: { id: true, displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: requests };
  }

  async getRequest(organizationId: string, userId: string, requestId: string) {
    await this.getAuthorizedUser(userId, organizationId);

    const request = await this.db.bloodRequest.findFirst({
      where: {
        id: requestId,
        OR: [{ requestingOrganizationId: organizationId }, { fulfillingOrganizationId: organizationId }],
      },
      include: {
        items: {
          include: {
            reservations: {
              where: { status: ReservationStatus.ACTIVE },
              include: { bloodUnit: true },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' } },
        shipment: {
          include: {
            courier: { select: { id: true, displayName: true, phone: true } },
            locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
            events: { orderBy: { createdAt: 'desc' } },
          },
        },
        requestingOrganization: { select: { id: true, name: true } },
        fulfillingOrganization: { select: { id: true, name: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found.');
    }

    return request;
  }

  async approveRequest(
    organizationId: string,
    userId: string,
    requestId: string,
    dto: {
      items: Array<{
        itemId: string;
        unitsApproved: number;
      }>;
      notes?: string;
    },
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const request = await this.db.bloodRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found.');
    }

    if (request.status !== BloodRequestStatus.SUBMITTED && request.status !== BloodRequestStatus.UNDER_REVIEW) {
      throw new BadRequestException('Request cannot be approved in current state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      for (const approval of dto.items) {
        const item = request.items.find((i: { id: string }) => i.id === approval.itemId);
        if (!item) continue;

        await tx.bloodRequestItem.update({
          where: { id: approval.itemId },
          data: { unitsApproved: approval.unitsApproved },
        });

        if (approval.unitsApproved > 0) {
          const reservations = await tx.bloodUnitReservation.findMany({
            where: {
              organizationId,
              status: ReservationStatus.ACTIVE,
              bloodUnit: {
                bloodType: item.bloodType,
                rhFactor: item.rhFactor,
                status: 'AVAILABLE',
                organizationId,
              },
            },
            include: { bloodUnit: true },
            take: approval.unitsApproved,
            orderBy: { reservedAt: 'asc' },
          });

          for (const reservation of reservations) {
            await tx.bloodUnitReservation.update({
              where: { id: reservation.id },
              data: {
                reservedForOrganizationId: request.requestingOrganizationId,
                reason: `Blood request ${request.requestReference}`,
              },
            });

            await tx.bloodUnit.update({
              where: { id: reservation.bloodUnitId },
              data: { status: 'RESERVED' },
            });
          }
        }
      }

      const allItems = await tx.bloodRequestItem.findMany({ where: { bloodRequestId: requestId } });
      const totalApproved = allItems.reduce((sum: number, i: { unitsApproved: number }) => sum + i.unitsApproved, 0);
      const totalRequested = allItems.reduce((sum: number, i: { unitsRequested: number }) => sum + i.unitsRequested, 0);

      let status: BloodRequestStatus = BloodRequestStatus.APPROVED;
      if (totalApproved < totalRequested && totalApproved > 0) {
        status = BloodRequestStatus.PARTIALLY_APPROVED;
      }

      const updated = await tx.bloodRequest.update({
        where: { id: requestId },
        data: {
          status,
          fulfillingOrganizationId: organizationId,
          notes: dto.notes ? `${request.notes || ''}\n${dto.notes}`.trim() : request.notes,
        },
      });

      await tx.bloodRequestEvent.create({
        data: {
          bloodRequestId: requestId,
          eventType: status === BloodRequestStatus.APPROVED ? 'APPROVED' : 'PARTIALLY_APPROVED',
          actorId: user.id,
          organizationId,
          metadata: { items: dto.items },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'BLOOD_REQUEST_APPROVED',
      entityType: 'BloodRequest',
      entityId: requestId,
      organizationId,
      metadata: { status: result.status },
    });

    return result;
  }

  async markReadyForPickup(
    organizationId: string,
    userId: string,
    requestId: string,
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const request = await this.db.bloodRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found.');
    }

    if (request.status !== BloodRequestStatus.APPROVED && request.status !== BloodRequestStatus.PARTIALLY_APPROVED) {
      throw new BadRequestException('Request must be approved before marking ready for pickup.');
    }

    const hasReservedUnits = request.items.some(
      (i: { unitsApproved: number }) => i.unitsApproved > 0,
    );

    if (!hasReservedUnits) {
      throw new BadRequestException('No units have been reserved for this request.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.bloodRequest.update({
        where: { id: requestId },
        data: { status: BloodRequestStatus.READY_FOR_PICKUP },
      });

      await tx.bloodRequestEvent.create({
        data: {
          bloodRequestId: requestId,
          eventType: 'READY_FOR_PICKUP',
          actorId: user.id,
          organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'BLOOD_REQUEST_READY_FOR_PICKUP',
      entityType: 'BloodRequest',
      entityId: requestId,
      organizationId,
    });

    return result;
  }

  async createShipment(
    organizationId: string,
    userId: string,
    requestId: string,
    dto: {
      pickupAddress?: string;
      pickupLatitude?: number;
      pickupLongitude?: number;
    },
    ipAddress?: string,
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const request = await this.db.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            reservations: {
              where: { status: ReservationStatus.ACTIVE },
              include: { bloodUnit: true },
            },
          },
        },
        shipment: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found.');
    }

    if (request.status !== BloodRequestStatus.READY_FOR_PICKUP) {
      throw new BadRequestException('Request is not ready for pickup.');
    }

    if (request.shipment) {
      throw new ConflictException('A shipment already exists for this request.');
    }

    if (!request.fulfillingOrganizationId || request.fulfillingOrganizationId !== organizationId) {
      throw new ForbiddenException('You are not fulfilling this request.');
    }

    const destinationOrg = await this.db.organization.findUnique({
      where: { id: request.requestingOrganizationId },
    });

    if (!destinationOrg) {
      throw new NotFoundException('Destination organization not found.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          shipmentReference: this.generateShipmentReference(),
          bloodRequestId: requestId,
          sourceOrganizationId: organizationId,
          destinationOrganizationId: request.requestingOrganizationId,
          status: ShipmentStatus.CREATED,
          pickupAddress: dto.pickupAddress || destinationOrg.address || undefined,
          pickupLatitude: dto.pickupLatitude ? new Prisma.Decimal(dto.pickupLatitude) : (destinationOrg.latitude ? new Prisma.Decimal(Number(destinationOrg.latitude)) : undefined),
          pickupLongitude: dto.pickupLongitude ? new Prisma.Decimal(dto.pickupLongitude) : (destinationOrg.longitude ? new Prisma.Decimal(Number(destinationOrg.longitude)) : undefined),
          destinationAddress: request.deliveryAddress || destinationOrg.address || undefined,
          destinationLatitude: request.deliveryLatitude || undefined,
          destinationLongitude: request.deliveryLongitude || undefined,
        },
      });

      for (const item of request.items) {
        for (const reservation of item.reservations) {
          await tx.shipmentUnit.create({
            data: {
              shipmentId: shipment.id,
              bloodUnitId: reservation.bloodUnitId,
              reservationId: reservation.id,
              bloodRequestItemId: item.id,
              status: 'PENDING',
            },
          });
        }
      }

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: ShipmentEventType.CREATED,
          actorId: user.id,
          organizationId,
        },
      });

      await tx.bloodRequestEvent.create({
        data: {
          bloodRequestId: requestId,
          eventType: 'SHIPMENT_CREATED',
          actorId: user.id,
          organizationId,
          metadata: { shipmentId: shipment.id, shipmentReference: shipment.shipmentReference },
        },
      });

      return shipment;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SHIPMENT_CREATED',
      entityType: 'Shipment',
      entityId: result.id,
      organizationId,
      metadata: { shipmentReference: result.shipmentReference, bloodRequestId: requestId },
      ipAddress,
    });

    return result;
  }

  async getShipments(
    organizationId: string,
    userId: string,
    filters: {
      status?: string;
      type?: 'source' | 'destination';
    },
  ) {
    await this.getAuthorizedUser(userId, organizationId);

    const where: Prisma.ShipmentWhereInput = {};
    if (filters.type === 'source') {
      where.sourceOrganizationId = organizationId;
    } else if (filters.type === 'destination') {
      where.destinationOrganizationId = organizationId;
    } else {
      where.OR = [
        { sourceOrganizationId: organizationId },
        { destinationOrganizationId: organizationId },
      ];
    }
    if (filters.status) where.status = filters.status as ShipmentStatus;

    const shipments = await this.db.shipment.findMany({
      where,
      include: {
        bloodRequest: { select: { id: true, requestReference: true, priority: true } },
        sourceOrganization: { select: { id: true, name: true } },
        destinationOrganization: { select: { id: true, name: true } },
        courier: { select: { id: true, displayName: true, phone: true, status: true } },
        units: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: shipments };
  }

  async getShipment(organizationId: string, userId: string, shipmentId: string) {
    await this.getAuthorizedUser(userId, organizationId);

    const shipment = await this.db.shipment.findFirst({
      where: {
        id: shipmentId,
        OR: [
          { sourceOrganizationId: organizationId },
          { destinationOrganizationId: organizationId },
        ],
      },
      include: {
        bloodRequest: {
          select: {
            id: true,
            requestReference: true,
            priority: true,
            status: true,
            deliveryAddress: true,
            deliveryPhone: true,
          },
        },
        sourceOrganization: { select: { id: true, name: true, address: true } },
        destinationOrganization: { select: { id: true, name: true, address: true } },
        courier: { select: { id: true, displayName: true, phone: true, status: true } },
        units: {
          include: {
            bloodUnit: {
              select: { id: true, unitReference: true, bloodType: true, rhFactor: true, volumeMl: true, componentType: true },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' } },
        locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    return shipment;
  }

  async getAvailableCouriers(organizationId: string, userId: string) {
    await this.checkBloodCenterAccess(userId, organizationId);

    const couriers = await this.db.courier.findMany({
      where: {
        organizationId,
        status: CourierStatus.AVAILABLE,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        shipments: {
          where: {
            status: {
              notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
            },
          },
          select: { id: true },
        },
      },
    });

    return couriers.map((c: any) => ({
      id: c.id,
      displayName: c.displayName,
      phone: c.phone,
      status: c.status,
      activeShipments: c.shipments.length,
    }));
  }

  async assignCourier(
    organizationId: string,
    userId: string,
    shipmentId: string,
    courierId: string,
    ipAddress?: string,
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const [shipment, courier] = await Promise.all([
      this.db.shipment.findUnique({ where: { id: shipmentId } }),
      this.db.courier.findUnique({ where: { id: courierId } }),
    ]);

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (!courier) {
      throw new NotFoundException('Courier not found.');
    }

    if (shipment.sourceOrganizationId !== organizationId) {
      throw new ForbiddenException('You cannot assign couriers to this shipment.');
    }

    if (shipment.status !== ShipmentStatus.CREATED) {
      throw new BadRequestException('Shipment is not in CREATED state.');
    }

    if (courier.status !== CourierStatus.AVAILABLE) {
      throw new ConflictException('Courier is not available.');
    }

    if (courier.organizationId !== organizationId) {
      throw new ForbiddenException('Courier does not belong to your organization.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          courierId,
          status: ShipmentStatus.COURIER_ASSIGNED,
          assignedAt: new Date(),
        },
      });

      await tx.courier.update({
        where: { id: courierId },
        data: { status: CourierStatus.BUSY },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.COURIER_ASSIGNED,
          actorId: user.id,
          organizationId,
          metadata: { courierId, courierName: courier.displayName },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SHIPMENT_COURIER_ASSIGNED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId,
      metadata: { courierId, shipmentReference: shipment.shipmentReference },
      ipAddress,
    });

    return result;
  }

  async acceptShipment(courierId: string, shipmentId: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { bloodRequest: { select: { requestReference: true } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.COURIER_ASSIGNED) {
      throw new BadRequestException('Shipment is not in COURIER_ASSIGNED state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.COURIER_ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.COURIER_ACCEPTED,
          actorId: courier.userId,
          organizationId: courier.organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_COURIER_ACCEPTED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference },
      ipAddress,
    });

    return result;
  }

  async declineShipment(courierId: string, shipmentId: string, reason?: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { bloodRequest: { select: { requestReference: true } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.COURIER_ASSIGNED) {
      throw new BadRequestException('Shipment is not in COURIER_ASSIGNED state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.COURIER_DECLINED,
          courierId: null,
          declinedAt: new Date(),
          declineReason: reason,
        },
      });

      await tx.courier.update({
        where: { id: courier.id },
        data: { status: CourierStatus.AVAILABLE },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.COURIER_DECLINED,
          actorId: courier.userId,
          organizationId: courier.organizationId,
          metadata: { reason },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_COURIER_DECLINED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference, reason },
      ipAddress,
    });

    return result;
  }

  async startPickup(courierId: string, shipmentId: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { bloodRequest: { select: { requestReference: true } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.COURIER_ACCEPTED) {
      throw new BadRequestException('Shipment is not in COURIER_ACCEPTED state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.PICKUP_STARTED,
          pickupStartedAt: new Date(),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.PICKUP_STARTED,
          actorId: courier.userId,
          organizationId: courier.organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_PICKUP_STARTED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference },
      ipAddress,
    });

    return result;
  }

  async confirmPickup(courierId: string, shipmentId: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: { select: { requestReference: true } },
        units: {
          include: {
            bloodUnit: true,
            reservation: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.PICKUP_STARTED) {
      throw new BadRequestException('Shipment is not in PICKUP_STARTED state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const now = new Date();

      for (const unit of shipment.units) {
        await tx.shipmentUnit.update({
          where: { id: unit.id },
          data: {
            pickedUpAt: now,
            status: 'PICKED_UP',
          },
        });

        await tx.inventoryMovement.create({
          data: {
            bloodUnitId: unit.bloodUnitId,
            organizationId: shipment.sourceOrganizationId,
            fromLocationId: unit.bloodUnit.locationId || undefined,
            type: MovementType.TRANSFER_OUT,
            actorId: courier.userId,
            reason: `Shipment ${shipment.shipmentReference} pickup`,
          },
        });
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.PICKED_UP,
          pickedUpAt: now,
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.PICKED_UP,
          actorId: courier.userId,
          organizationId: courier.organizationId,
          metadata: { unitsPickedUp: shipment.units.length },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_PICKED_UP',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference, unitsPickedUp: shipment.units.length },
      ipAddress,
    });

    return result;
  }

  async startDelivery(courierId: string, shipmentId: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { bloodRequest: { select: { requestReference: true } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.PICKED_UP) {
      throw new BadRequestException('Shipment is not in PICKED_UP state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.IN_TRANSIT,
          inTransitAt: new Date(),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.IN_TRANSIT,
          actorId: courier.userId,
          organizationId: courier.organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_IN_TRANSIT',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference },
      ipAddress,
    });

    return result;
  }

  async updateLocation(
    courierId: string,
    shipmentId: string,
    dto: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    },
    ipAddress?: string,
  ) {
    const courier = await this.checkCourierAccess(courierId);

    if (dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException('Invalid latitude.');
    }
    if (dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Invalid longitude.');
    }

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    const activeStatuses: ShipmentStatus[] = [
      ShipmentStatus.COURIER_ACCEPTED,
      ShipmentStatus.PICKUP_STARTED,
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.ARRIVED_AT_HOSPITAL,
    ];

    if (!activeStatuses.includes(shipment.status as ShipmentStatus)) {
      throw new BadRequestException('Cannot update location for shipment in current state.');
    }

    const location = await this.db.shipmentLocation.create({
      data: {
        shipmentId,
        courierId: courier.id,
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
        accuracy: dto.accuracy ? new Prisma.Decimal(dto.accuracy) : undefined,
        heading: dto.heading ? new Prisma.Decimal(dto.heading) : undefined,
        speed: dto.speed ? new Prisma.Decimal(dto.speed) : undefined,
      },
    });

    await this.db.shipmentEvent.create({
      data: {
        shipmentId,
        eventType: ShipmentEventType.LOCATION_UPDATED,
        actorId: courier.userId,
        organizationId: courier.organizationId,
        metadata: { latitude: dto.latitude, longitude: dto.longitude },
      },
    });

    return location;
  }

  async arriveAtHospital(courierId: string, shipmentId: string, ipAddress?: string) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: { bloodRequest: { select: { requestReference: true } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    if (shipment.status !== ShipmentStatus.IN_TRANSIT) {
      throw new BadRequestException('Shipment is not in IN_TRANSIT state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.ARRIVED_AT_HOSPITAL,
          arrivedAt: new Date(),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.ARRIVED_AT_HOSPITAL,
          actorId: courier.userId,
          organizationId: courier.organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_ARRIVED_AT_HOSPITAL',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference },
      ipAddress,
    });

    return result;
  }

  async confirmDelivery(
    organizationId: string,
    userId: string,
    shipmentId: string,
    dto: { verificationCode?: string },
    ipAddress?: string,
  ) {
    const { user } = await this.checkHospitalAccess(userId, organizationId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        units: {
          include: {
            bloodUnit: true,
            reservation: true,
          },
        },
        bloodRequest: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.destinationOrganizationId !== organizationId) {
      throw new ForbiddenException('This shipment is not destined for your organization.');
    }

    if (shipment.status !== ShipmentStatus.ARRIVED_AT_HOSPITAL) {
      throw new BadRequestException('Shipment has not arrived at the hospital.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const now = new Date();

      for (const unit of shipment.units) {
        await tx.shipmentUnit.update({
          where: { id: unit.id },
          data: {
            deliveredAt: now,
            status: 'DELIVERED',
          },
        });

        await tx.bloodUnit.update({
          where: { id: unit.bloodUnitId },
          data: {
            organizationId: organizationId,
            status: 'AVAILABLE',
          },
        });

        await tx.inventoryMovement.create({
          data: {
            bloodUnitId: unit.bloodUnitId,
            organizationId,
            type: MovementType.TRANSFER_IN,
            actorId: user.id,
            reason: `Shipment ${shipment.shipmentReference} delivery`,
          },
        });

        await tx.bloodUnitReservation.update({
          where: { id: unit.reservationId },
          data: {
            status: ReservationStatus.FULFILLED,
            fulfilledAt: now,
          },
        });
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: now,
        },
      });

      await tx.bloodRequest.update({
        where: { id: shipment.bloodRequestId },
        data: {
          status: BloodRequestStatus.DELIVERED,
          deliveredAt: now,
        },
      });

      await tx.courier.update({
        where: { id: shipment.courierId! },
        data: { status: CourierStatus.AVAILABLE },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.DELIVERED,
          actorId: user.id,
          organizationId,
          metadata: { unitsDelivered: shipment.units.length },
        },
      });

      await tx.bloodRequestEvent.create({
        data: {
          bloodRequestId: shipment.bloodRequestId,
          eventType: 'DELIVERED',
          actorId: user.id,
          organizationId,
          metadata: { shipmentId, shipmentReference: shipment.shipmentReference },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SHIPMENT_DELIVERED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId,
      metadata: { shipmentReference: shipment.shipmentReference, unitsDelivered: shipment.units.length },
      ipAddress,
    });

    return result;
  }

  async failShipment(
    courierId: string,
    shipmentId: string,
    dto: {
      reason: string;
      notes?: string;
    },
    ipAddress?: string,
  ) {
    const courier = await this.checkCourierAccess(courierId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: { select: { requestReference: true } },
        units: { include: { bloodUnit: true, reservation: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.courierId !== courier.id) {
      throw new ForbiddenException('This shipment is not assigned to you.');
    }

    const failedStatuses: ShipmentStatus[] = [
      ShipmentStatus.COURIER_ACCEPTED,
      ShipmentStatus.PICKUP_STARTED,
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
    ];

    if (!failedStatuses.includes(shipment.status as ShipmentStatus)) {
      throw new BadRequestException('Shipment cannot be failed in current state.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.FAILED,
          failedAt: new Date(),
          failureReason: dto.reason as DeliveryFailureReason,
          failureNotes: dto.notes,
        },
      });

      for (const unit of shipment.units) {
        await tx.shipmentUnit.update({
          where: { id: unit.id },
          data: { status: 'FAILED' },
        });

        await tx.bloodUnit.update({
          where: { id: unit.bloodUnitId },
          data: { status: 'RESERVED' },
        });
      }

      await tx.courier.update({
        where: { id: courier.id },
        data: { status: CourierStatus.AVAILABLE },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.FAILED,
          actorId: courier.userId,
          organizationId: courier.organizationId,
          metadata: { reason: dto.reason, notes: dto.notes },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: courier.userId,
      action: 'SHIPMENT_FAILED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId: courier.organizationId,
      metadata: { shipmentReference: shipment.shipmentReference, reason: dto.reason },
      ipAddress,
    });

    return result;
  }

  async getShipmentLocations(shipmentId: string, userId: string) {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: { select: { requestingOrganizationId: true } },
        courier: { select: { userId: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    const courier = await this.db.courier.findUnique({
      where: { userId },
    });

    const isAuthorized =
      shipment.sourceOrganizationId === courier?.organizationId ||
      shipment.destinationOrganizationId === shipment.bloodRequest.requestingOrganizationId ||
      courier?.userId === shipment.courier?.userId;

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized to view this shipment location.');
    }

    const locations = await this.db.shipmentLocation.findMany({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });

    return locations;
  }

  async getCourierShipments(courierId: string, filters?: { status?: string }) {
    const courier = await this.checkCourierAccess(courierId);

    const where: Prisma.ShipmentWhereInput = { courierId: courier.id };
    if (filters?.status) {
      where.status = filters.status as ShipmentStatus;
    }

    const shipments = await this.db.shipment.findMany({
      where,
      include: {
        bloodRequest: { select: { requestReference: true, priority: true } },
        sourceOrganization: { select: { name: true } },
        destinationOrganization: { select: { name: true } },
        locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: shipments };
  }
}
