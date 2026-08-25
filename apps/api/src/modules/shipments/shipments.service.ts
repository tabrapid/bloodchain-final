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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Courier, Organization, User } from '@prisma/client';
import { LocationService } from './services/location.service';
import { ShipmentStateMachine } from './services/shipment-state.service';
import { ShipmentGateway } from '../../gateways/shipment.gateway';

const SHIPMENT_EVENT = 'shipment.event';

type OrganizationWithType = Organization & { __typename?: string };

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly locationService: LocationService,
    private readonly shipmentGateway: ShipmentGateway,
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
            // Atomic conditional update: only claim the unit if it's still
            // AVAILABLE at lock time, closing the race with concurrent approvals.
            const { count } = await tx.bloodUnit.updateMany({
              where: { id: reservation.bloodUnitId, status: 'AVAILABLE' },
              data: { status: 'RESERVED' },
            });
            if (count === 0) continue;

            await tx.bloodUnitReservation.update({
              where: { id: reservation.id },
              data: {
                reservedForOrganizationId: request.requestingOrganizationId,
                reason: `Blood request ${request.requestReference}`,
              },
            });
          }
        }
      }

      const allItems = await tx.bloodRequestItem.findMany({ where: { bloodRequestId: requestId } });
      const totalApproved = allItems.reduce((sum: number, i: { unitsApproved: number }) => sum + i.unitsApproved, 0);
      const totalRequested = allItems.reduce((sum: number, i: { unitsRequested: number }) => sum + i.unitsRequested, 0);

      let status: BloodRequestStatus = BloodRequestStatus.APPROVED;
      if (totalApproved === 0) {
        status = BloodRequestStatus.REJECTED;
      } else if (totalApproved < totalRequested) {
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
          eventType:
            status === BloodRequestStatus.APPROVED
              ? 'APPROVED'
              : status === BloodRequestStatus.REJECTED
                ? 'REJECTED'
                : 'PARTIALLY_APPROVED',
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

    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId: result.id,
      eventType: 'created',
      recipientIds: bloodCenterUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(result.id, ShipmentStatus.CREATED);

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

  // Unlike getAvailableCouriers above (used to populate an assignment
  // dropdown, so intentionally AVAILABLE-only), this returns the full
  // roster regardless of status for the courier management/roster view.
  async getCourierRoster(organizationId: string, userId: string) {
    await this.checkBloodCenterAccess(userId, organizationId);

    const couriers = await this.db.courier.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        shipments: {
          where: {
            status: {
              notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
            },
          },
          select: { id: true },
        },
        _count: {
          select: {
            shipments: { where: { status: ShipmentStatus.DELIVERED } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: couriers.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        phone: c.phone,
        email: c.user.email,
        status: c.status,
        activeShipments: c.shipments.length,
        completedShipments: c._count.shipments,
        createdAt: c.createdAt,
      })),
    };
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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.COURIER_ASSIGNED);

    if (courier.status !== CourierStatus.AVAILABLE) {
      throw new ConflictException('Courier is not available.');
    }

    if (courier.organizationId !== organizationId) {
      throw new ForbiddenException('Courier does not belong to your organization.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const shipmentClaim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ASSIGNED) },
        },
        data: {
          courierId,
          status: ShipmentStatus.COURIER_ASSIGNED,
          assignedAt: new Date(),
        },
      });

      if (shipmentClaim.count === 0) {
        throw new ConflictException('Shipment can no longer be assigned from its current state.');
      }

      const courierClaim = await tx.courier.updateMany({
        where: { id: courierId, status: CourierStatus.AVAILABLE },
        data: { status: CourierStatus.BUSY },
      });

      if (courierClaim.count === 0) {
        throw new ConflictException('Courier is no longer available.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'courier_assigned',
      recipientIds: [courier.userId],
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.COURIER_ASSIGNED);

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.COURIER_ACCEPTED);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ACCEPTED) },
        },
        data: {
          status: ShipmentStatus.COURIER_ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer be accepted from its current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.sourceOrganizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'accepted',
      recipientIds: bloodCenterUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.COURIER_ACCEPTED);

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.COURIER_DECLINED);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_DECLINED) },
        },
        data: {
          status: ShipmentStatus.COURIER_DECLINED,
          courierId: null,
          declinedAt: new Date(),
          declineReason: reason,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer be declined from its current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.COURIER_DECLINED, { reason });

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.PICKUP_STARTED);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.PICKUP_STARTED) },
        },
        data: {
          status: ShipmentStatus.PICKUP_STARTED,
          pickupStartedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer start pickup from its current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.PICKUP_STARTED);

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.PICKED_UP);

    const result = await this.db.$transaction(async (tx) => {
      const now = new Date();

      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.PICKED_UP) },
        },
        data: {
          status: ShipmentStatus.PICKED_UP,
          pickedUpAt: now,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer be confirmed as picked up from its current state.');
      }

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

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.sourceOrganizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'picked_up',
      recipientIds: bloodCenterUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.PICKED_UP);

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.IN_TRANSIT);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.IN_TRANSIT) },
        },
        data: {
          status: ShipmentStatus.IN_TRANSIT,
          inTransitAt: new Date(),
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer start delivery from its current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const hospitalUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.destinationOrganizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'in_transit',
      recipientIds: hospitalUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.IN_TRANSIT);

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

    const access = await this.locationService.validateCourierShipmentAccess(
      courier.id,
      shipmentId,
    );

    if (!access.valid) {
      if (access.error === 'Shipment not found') {
        throw new NotFoundException(access.error);
      }
      if (access.error === 'Shipment is not assigned to this courier') {
        throw new ForbiddenException(access.error);
      }
      throw new BadRequestException(access.error ?? 'Cannot update location for this shipment.');
    }

    // Reject spoofed/corrupted GPS: out-of-range coordinates, physically
    // impossible jumps since the last known point, and stale/future
    // timestamps. Speed/accuracy issues are logged but don't block the
    // update, since GPS noise alone shouldn't drop a legitimate ping.
    const sanityCheck = await this.locationService.validateLocationUpdate(courier.id, shipmentId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      heading: dto.heading,
      speed: dto.speed,
      timestamp: new Date(),
    });

    if (!sanityCheck.isValid) {
      throw new BadRequestException(sanityCheck.errors.join(' '));
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

    // The mobile courier app submits location updates over REST, not the
    // gateway's own `location_update` socket event, so this is the only
    // place that broadcasts a REST-submitted position to live-tracking
    // web clients watching this shipment's room.
    this.shipmentGateway.emitCourierLocation(shipmentId, {
      courierId: courier.id,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: location.accuracy ? Number(location.accuracy) : null,
      heading: location.heading ? Number(location.heading) : null,
      speed: location.speed ? Number(location.speed) : null,
      recordedAt: location.recordedAt.toISOString(),
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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.ARRIVED_AT_HOSPITAL);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.ARRIVED_AT_HOSPITAL) },
        },
        data: {
          status: ShipmentStatus.ARRIVED_AT_HOSPITAL,
          arrivedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer arrive at the hospital from its current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const hospitalUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.destinationOrganizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'arrived',
      recipientIds: hospitalUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.ARRIVED_AT_HOSPITAL);

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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.DELIVERED);

    const result = await this.db.$transaction(async (tx) => {
      const now = new Date();

      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.DELIVERED) },
        },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: now,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer be delivered from its current state.');
      }

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

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.sourceOrganizationId } } },
      select: { id: true },
    });

    const courierUser = await this.db.courier.findUnique({
      where: { id: shipment.courierId! },
      select: { userId: true },
    });

    const recipientIds = [
      ...bloodCenterUsers.map((u) => u.id),
      ...(courierUser ? [courierUser.userId] : []),
    ];

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'delivered',
      recipientIds,
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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.FAILED);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.FAILED) },
        },
        data: {
          status: ShipmentStatus.FAILED,
          failedAt: new Date(),
          failureReason: dto.reason as DeliveryFailureReason,
          failureNotes: dto.notes,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment cannot be failed in current state.');
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

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

    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.sourceOrganizationId } } },
      select: { id: true },
    });

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'failed',
      recipientIds: bloodCenterUsers.map((u) => u.id),
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.FAILED);

    return result;
  }

  async getShipmentLocations(shipmentId: string, userId: string) {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    const courier = await this.db.courier.findUnique({ where: { userId } });
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    const organizationIds = user?.memberships.map((m) => m.organizationId) || [];
    const isAuthorized =
      organizationIds.includes(shipment.sourceOrganizationId) ||
      organizationIds.includes(shipment.destinationOrganizationId) ||
      (courier && shipment.courierId === courier.id);

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

  async getShipmentTimeline(shipmentId: string, userId: string) {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: { select: { requestingOrganizationId: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    const courier = await this.db.courier.findUnique({ where: { userId } });
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    const organizationIds = user?.memberships.map((m: any) => m.organizationId) || [];
    const isAuthorized =
      shipment.sourceOrganizationId === courier?.organizationId ||
      shipment.destinationOrganizationId === courier?.organizationId ||
      organizationIds.includes(shipment.sourceOrganizationId) ||
      organizationIds.includes(shipment.destinationOrganizationId) ||
      (courier && shipment.courierId === courier.id);

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized to view this shipment timeline.');
    }

    const events = await this.db.shipmentEvent.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { firstName: true, lastName: true } },
        organization: { select: { name: true } },
      },
    });

    const timeline = events.map((event: any) => ({
      id: event.id,
      type: event.eventType,
      timestamp: event.createdAt,
      actor: event.actor
        ? `${event.actor.firstName} ${event.actor.lastName}`
        : 'System',
      organization: event.organization?.name,
      metadata: event.metadata,
    }));

    return {
      shipmentId,
      reference: shipment.shipmentReference,
      status: shipment.status,
      timeline,
    };
  }

  async getShipmentTracking(shipmentId: string, userId: string) {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: {
          select: {
            id: true,
            requestReference: true,
            priority: true,
          },
        },
        sourceOrganization: {
          select: { id: true, name: true, address: true },
        },
        destinationOrganization: {
          select: { id: true, name: true, address: true },
        },
        courier: {
          select: { id: true, displayName: true, phone: true },
        },
        units: {
          select: { id: true },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    const courier = await this.db.courier.findUnique({ where: { userId } });
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    const organizationIds = user?.memberships.map((m: any) => m.organizationId) || [];
    const isAuthorized =
      shipment.sourceOrganizationId === courier?.organizationId ||
      shipment.destinationOrganizationId === courier?.organizationId ||
      organizationIds.includes(shipment.sourceOrganizationId) ||
      organizationIds.includes(shipment.destinationOrganizationId) ||
      (courier && shipment.courierId === courier.id);

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized to view this shipment tracking.');
    }

    const lastLocation = await this.db.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    const latestEvent = await this.db.shipmentEvent.findFirst({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });

    let eta = null;
    if (lastLocation && shipment.destinationLatitude && shipment.destinationLongitude) {
      const distance = this.calculateHaversineDistance(
        Number(lastLocation.latitude),
        Number(lastLocation.longitude),
        Number(shipment.destinationLatitude),
        Number(shipment.destinationLongitude),
      );
      const etaMinutes = Math.round((distance / 40) * 60);
      eta = {
        distanceKm: Math.round(distance * 10) / 10,
        etaMinutes,
        calculatedAt: new Date().toISOString(),
        note: 'Estimated based on straight-line distance and average speed. Not a guaranteed delivery time.',
      };
    }

    return {
      shipmentId,
      reference: shipment.shipmentReference,
      status: shipment.status,
      priority: shipment.bloodRequest.priority,
      bloodGroup: 'Available after delivery confirmation',
      units: shipment.units?.length || 0,
      source: {
        id: shipment.sourceOrganization.id,
        name: shipment.sourceOrganization.name,
        address: shipment.sourceOrganization.address,
        coordinates: shipment.pickupLatitude && shipment.pickupLongitude ? {
          latitude: Number(shipment.pickupLatitude),
          longitude: Number(shipment.pickupLongitude),
        } : null,
      },
      destination: {
        id: shipment.destinationOrganization.id,
        name: shipment.destinationOrganization.name,
        address: shipment.destinationOrganization.address,
        coordinates: shipment.destinationLatitude && shipment.destinationLongitude ? {
          latitude: Number(shipment.destinationLatitude),
          longitude: Number(shipment.destinationLongitude),
        } : null,
      },
      courier: shipment.courier ? {
        id: shipment.courier.id,
        name: shipment.courier.displayName,
        phone: shipment.courier.phone,
      } : null,
      currentLocation: lastLocation ? {
        latitude: Number(lastLocation.latitude),
        longitude: Number(lastLocation.longitude),
        recordedAt: lastLocation.recordedAt.toISOString(),
      } : null,
      eta,
      lastUpdated: latestEvent?.createdAt.toISOString(),
      timestamps: {
        createdAt: shipment.createdAt.toISOString(),
        assignedAt: shipment.assignedAt?.toISOString(),
        acceptedAt: shipment.acceptedAt?.toISOString(),
        pickedUpAt: shipment.pickedUpAt?.toISOString(),
        inTransitAt: shipment.inTransitAt?.toISOString(),
        arrivedAt: shipment.arrivedAt?.toISOString(),
        deliveredAt: shipment.deliveredAt?.toISOString(),
        estimatedArrivalAt: shipment.estimatedArrivalAt?.toISOString(),
      },
    };
  }

  async cancelShipment(
    organizationId: string,
    userId: string,
    shipmentId: string,
    reason?: string,
    ipAddress?: string,
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        bloodRequest: { select: { requestReference: true } },
        units: { select: { id: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (shipment.sourceOrganizationId !== organizationId) {
      throw new ForbiddenException('You cannot cancel this shipment.');
    }

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.CANCELLED);

    const result = await this.db.$transaction(async (tx) => {
      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.CANCELLED) },
        },
        data: {
          status: ShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Cannot cancel a delivered or already cancelled shipment.');
      }

      if (shipment.courierId) {
        await tx.courier.update({
          where: { id: shipment.courierId },
          data: { status: CourierStatus.AVAILABLE },
        });
      }

      for (const unit of shipment.units) {
        await tx.shipmentUnit.update({
          where: { id: unit.id },
          data: { status: 'CANCELLED' },
        });
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.CANCELLED,
          actorId: user.id,
          organizationId,
          metadata: { reason },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SHIPMENT_CANCELLED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId,
      metadata: { shipmentReference: shipment.shipmentReference, reason },
      ipAddress,
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.CANCELLED, { reason });

    return result;
  }

  async reassignCourier(
    organizationId: string,
    userId: string,
    shipmentId: string,
    newCourierId: string,
    ipAddress?: string,
  ) {
    const { user } = await this.checkBloodCenterAccess(userId, organizationId);

    const [shipment, newCourier] = await Promise.all([
      this.db.shipment.findUnique({ where: { id: shipmentId } }),
      this.db.courier.findUnique({ where: { id: newCourierId } }),
    ]);

    if (!shipment) {
      throw new NotFoundException('Shipment not found.');
    }

    if (!newCourier) {
      throw new NotFoundException('Courier not found.');
    }

    if (shipment.sourceOrganizationId !== organizationId) {
      throw new ForbiddenException('You cannot reassign this shipment.');
    }

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.COURIER_ASSIGNED);

    if (newCourier.organizationId !== organizationId) {
      throw new ForbiddenException('Courier does not belong to your organization.');
    }

    if (newCourier.status !== CourierStatus.AVAILABLE) {
      throw new ConflictException('New courier is not available.');
    }

    const oldCourierId = shipment.courierId;

    const result = await this.db.$transaction(async (tx) => {
      const shipmentClaim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ASSIGNED) },
        },
        data: {
          courierId: newCourierId,
          status: ShipmentStatus.COURIER_ASSIGNED,
          assignedAt: new Date(),
        },
      });

      if (shipmentClaim.count === 0) {
        throw new ConflictException('Shipment can no longer be reassigned from its current state.');
      }

      const courierClaim = await tx.courier.updateMany({
        where: { id: newCourierId, status: CourierStatus.AVAILABLE },
        data: { status: CourierStatus.BUSY },
      });

      if (courierClaim.count === 0) {
        throw new ConflictException('New courier is no longer available.');
      }

      if (oldCourierId && oldCourierId !== newCourierId) {
        await tx.courier.update({
          where: { id: oldCourierId },
          data: { status: CourierStatus.AVAILABLE },
        });
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.COURIER_ASSIGNED,
          actorId: user.id,
          organizationId,
          metadata: {
            courierId: newCourierId,
            courierName: newCourier.displayName,
            previousCourierId: oldCourierId,
          },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SHIPMENT_REASSIGNED',
      entityType: 'Shipment',
      entityId: shipmentId,
      organizationId,
      metadata: { newCourierId, previousCourierId: oldCourierId },
      ipAddress,
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.COURIER_ASSIGNED, {
      courierId: newCourierId,
    });

    return result;
  }

  async confirmDeliveryFull(
    organizationId: string,
    userId: string,
    shipmentId: string,
    dto: {
      unitsReceived: number;
      condition?: string;
      notes?: string;
      discrepancyReason?: string;
    },
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

    ShipmentStateMachine.assertTransition(shipment.status, ShipmentStatus.DELIVERED);

    const totalUnits = shipment.units.length;
    if (dto.unitsReceived > totalUnits) {
      throw new BadRequestException(`Cannot receive more units than shipped (${totalUnits}).`);
    }

    const hasDiscrepancy = dto.unitsReceived < totalUnits;
    if (hasDiscrepancy && !dto.discrepancyReason) {
      throw new BadRequestException('Discrepancy reason is required when units received does not match shipped units.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const now = new Date();

      const claim = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.DELIVERED) },
        },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: now,
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Shipment can no longer be delivered from its current state.');
      }

      const unitsToReceive = shipment.units.slice(0, dto.unitsReceived);

      for (const unit of unitsToReceive) {
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

      for (const unit of shipment.units.slice(dto.unitsReceived)) {
        await tx.shipmentUnit.update({
          where: { id: unit.id },
          data: {
            status: 'DISCREPANCY',
          },
        });

        await tx.bloodUnit.update({
          where: { id: unit.bloodUnitId },
          data: {
            status: 'RESERVED',
          },
        });
      }

      const updated = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

      await tx.bloodRequest.update({
        where: { id: shipment.bloodRequestId },
        data: {
          status: hasDiscrepancy ? BloodRequestStatus.PARTIALLY_DELIVERED : BloodRequestStatus.DELIVERED,
          deliveredAt: now,
        },
      });

      if (shipment.courierId) {
        await tx.courier.update({
          where: { id: shipment.courierId },
          data: { status: CourierStatus.AVAILABLE },
        });
      }

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.DELIVERED,
          actorId: user.id,
          organizationId,
          metadata: {
            unitsDelivered: dto.unitsReceived,
            totalUnits,
            condition: dto.condition,
            notes: dto.notes,
            discrepancy: hasDiscrepancy ? {
              unitsMissing: totalUnits - dto.unitsReceived,
              reason: dto.discrepancyReason,
            } : null,
          },
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
      metadata: {
        shipmentReference: shipment.shipmentReference,
        unitsDelivered: dto.unitsReceived,
        totalUnits,
        discrepancy: hasDiscrepancy,
      },
      ipAddress,
    });

    // This is the route actually wired to POST .../confirm-delivery (see
    // shipments.controller.ts) - confirmDelivery above is dead code that
    // was never reachable, which is why "delivered" push notifications and
    // live tracking updates never fired for real deliveries before this.
    const bloodCenterUsers = await this.db.user.findMany({
      where: { memberships: { some: { organizationId: shipment.sourceOrganizationId } } },
      select: { id: true },
    });

    const courierUser = shipment.courierId
      ? await this.db.courier.findUnique({
          where: { id: shipment.courierId },
          select: { userId: true },
        })
      : null;

    this.eventEmitter.emit(SHIPMENT_EVENT, {
      shipmentId,
      eventType: 'delivered',
      recipientIds: [...bloodCenterUsers.map((u) => u.id), ...(courierUser ? [courierUser.userId] : [])],
    });

    this.shipmentGateway.emitShipmentStatusChanged(shipmentId, ShipmentStatus.DELIVERED, {
      unitsDelivered: dto.unitsReceived,
      totalUnits,
      discrepancy: hasDiscrepancy,
    });

    return {
      ...result,
      deliveryDetails: {
        unitsDelivered: dto.unitsReceived,
        totalUnits,
        condition: dto.condition,
        notes: dto.notes,
        discrepancy: hasDiscrepancy ? {
          unitsMissing: totalUnits - dto.unitsReceived,
          reason: dto.discrepancyReason,
        } : null,
      },
    };
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
