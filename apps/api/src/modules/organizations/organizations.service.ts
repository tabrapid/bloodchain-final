import { Injectable } from '@nestjs/common';
import { OrganizationStatus, OrganizationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: PrismaService) {}

  async findMany(
    page = 1,
    limit = 20,
    filters?: {
      type?: OrganizationType;
      city?: string;
      status?: OrganizationStatus;
    },
  ) {
    // SYSTEM is an internal placeholder org (donor accounts' required FK
    // target) and is never a real, listable organization.
    const where: Prisma.OrganizationWhereInput = { type: { not: OrganizationType.SYSTEM } };

    if (filters?.type && filters.type !== OrganizationType.SYSTEM) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    } else {
      where.status = OrganizationStatus.ACTIVE;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          type: true,
          name: true,
          legalName: true,
          phone: true,
          email: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
          createdAt: true,
        },
      }),
      this.db.organization.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    return this.db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        name: true,
        legalName: true,
        phone: true,
        email: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getActiveOrganizations(
    page = 1,
    limit = 20,
    filters?: {
      type?: OrganizationType;
      city?: string;
    },
  ) {
    const where: Prisma.OrganizationWhereInput = {
      status: OrganizationStatus.ACTIVE,
      type: { not: OrganizationType.SYSTEM },
    };

    if (filters?.type && filters.type !== OrganizationType.SYSTEM) {
      where.type = filters.type;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          type: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      }),
      this.db.organization.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}