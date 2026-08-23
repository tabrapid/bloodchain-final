import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpdateCourierStatusDto, UpdateCourierProfileDto } from './dto/courier.dto';

@Injectable()
export class CourierService {
  constructor(private readonly db: PrismaService) {}

  async getCourierByUserId(userId: string) {
    const courier = await this.db.courier.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        shipments: {
          where: {
            status: {
              notIn: ['DELIVERED', 'FAILED', 'CANCELLED'],
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    return {
      id: courier.id,
      displayName: courier.displayName,
      phone: courier.phone,
      status: courier.status,
      organizationId: courier.organizationId,
      organizationName: courier.organization.name,
      currentShipmentId: courier.shipments[0]?.id || null,
      user: courier.user,
    };
  }

  async getCourierById(courierId: string) {
    const courier = await this.db.courier.findUnique({
      where: { id: courierId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!courier) {
      throw new NotFoundException('Courier not found');
    }

    return courier;
  }

  async updateCourierStatus(userId: string, dto: UpdateCourierStatusDto) {
    const courier = await this.db.courier.findUnique({
      where: { userId },
      include: {
        shipments: {
          where: {
            status: {
              notIn: ['DELIVERED', 'FAILED', 'CANCELLED'],
            },
          },
        },
      },
    });

    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    if (courier.shipments.length > 0 && dto.status === CourierStatus.OFFLINE) {
      throw new BadRequestException('Cannot go offline with active shipments');
    }

    if (dto.status === CourierStatus.AVAILABLE && courier.status === CourierStatus.BUSY) {
      if (courier.shipments.length > 0) {
        throw new BadRequestException('Cannot become available with active shipments');
      }
    }

    const updated = await this.db.courier.update({
      where: { userId },
      data: { status: dto.status },
    });

    return {
      id: updated.id,
      status: updated.status,
      previousStatus: courier.status,
    };
  }

  async updateCourierProfile(userId: string, dto: UpdateCourierProfileDto) {
    const courier = await this.db.courier.findUnique({
      where: { userId },
    });

    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    const updated = await this.db.courier.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        phone: dto.phone,
      },
    });

    return {
      id: updated.id,
      displayName: updated.displayName,
      phone: updated.phone,
    };
  }

  async getCourierShipments(
    courierId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Prisma.ShipmentWhereInput = {
      courierId,
    };

    if (filters?.status) {
      where.status = filters.status as any;
    }

    const [shipments, total] = await Promise.all([
      this.db.shipment.findMany({
        where,
        include: {
          bloodRequest: {
            select: {
              id: true,
              requestReference: true,
              priority: true,
            },
          },
          sourceOrganization: {
            select: { id: true, name: true },
          },
          destinationOrganization: {
            select: { id: true, name: true },
          },
          units: {
            select: { id: true, status: true },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          locations: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      this.db.shipment.count({ where }),
    ]);

    return {
      data: shipments,
      meta: {
        total,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      },
    };
  }

  async getActiveShipment(courierId: string) {
    const courier = await this.db.courier.findUnique({
      where: { id: courierId },
      include: {
        shipments: {
          where: {
            status: {
              in: [
                'COURIER_ASSIGNED',
                'COURIER_ACCEPTED',
                'PICKUP_STARTED',
                'PICKED_UP',
                'IN_TRANSIT',
                'ARRIVED_AT_HOSPITAL',
              ],
            },
          },
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
            units: {
              include: {
                bloodUnit: {
                  select: {
                    id: true,
                    bloodType: true,
                    rhFactor: true,
                    componentType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!courier) {
      throw new NotFoundException('Courier not found');
    }

    return courier.shipments[0] || null;
  }

  async getCourierStats(courierId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.ShipmentWhereInput = {
      courierId,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, completed, failed, cancelled] = await Promise.all([
      this.db.shipment.count({ where }),
      this.db.shipment.count({ where: { ...where, status: 'DELIVERED' } }),
      this.db.shipment.count({ where: { ...where, status: 'FAILED' } }),
      this.db.shipment.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

    const completedShipments = await this.db.shipment.findMany({
      where: { courierId, status: 'DELIVERED', deliveredAt: { not: null } },
      select: { deliveredAt: true, pickedUpAt: true },
    });

    let avgDeliveryTimeMinutes = null;
    if (completedShipments.length > 0) {
      const totalTime = completedShipments.reduce((acc, s) => {
        if (s.pickedUpAt && s.deliveredAt) {
          return acc + (s.deliveredAt.getTime() - s.pickedUpAt.getTime());
        }
        return acc;
      }, 0);
      avgDeliveryTimeMinutes = Math.round(totalTime / completedShipments.length / (1000 * 60));
    }

    return {
      total,
      completed,
      failed,
      cancelled,
      active: total - completed - failed - cancelled,
      avgDeliveryTimeMinutes,
    };
  }

  async getAvailableCouriersForOrganization(organizationId: string) {
    const couriers = await this.db.courier.findMany({
      where: {
        organizationId,
        status: CourierStatus.AVAILABLE,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        shipments: {
          where: {
            status: {
              notIn: ['DELIVERED', 'FAILED', 'CANCELLED'],
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
      user: c.user,
    }));
  }
}
