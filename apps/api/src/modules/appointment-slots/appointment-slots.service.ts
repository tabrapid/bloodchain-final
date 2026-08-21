import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentType, Prisma, RoleCode, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateAppointmentSlotDto, UpdateAppointmentSlotDto, GetAvailabilityDto } from './dto/appointment-slot.dto';

@Injectable()
export class AppointmentSlotsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async getAvailability(filters: GetAvailabilityDto) {
    const where: Prisma.AppointmentSlotWhereInput = {
      status: SlotStatus.AVAILABLE,
      startAt: { gte: new Date() },
    };

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.appointmentType) {
      where.appointmentType = filters.appointmentType;
    }

    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.startAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (filters.startDate && filters.endDate) {
      where.startAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    } else if (filters.startDate) {
      where.startAt = { gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      where.startAt = { lte: new Date(filters.endDate) };
    }

    const slots = await this.db.appointmentSlot.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
      },
    });

    const availableSlots = slots
      .filter((slot) => slot.bookedCount < slot.capacity)
      .map((slot) => ({
        id: slot.id,
        organizationId: slot.organizationId,
        organization: slot.organization,
        appointmentType: slot.appointmentType,
        startAt: slot.startAt,
        endAt: slot.endAt,
        capacity: slot.capacity,
        availableSpots: slot.capacity - slot.bookedCount,
        status: slot.status,
      }));

    return { data: availableSlots };
  }

  async getSlotsByOrganization(
    organizationId: string,
    requestingUserId: string,
    filters?: { appointmentType?: AppointmentType; startDate?: string; endDate?: string },
  ) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isStaff = user.memberships.some(
      (m) =>
        m.organization.id === organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );

    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to view these slots.');
    }

    const where: Prisma.AppointmentSlotWhereInput = { organizationId };

    if (filters?.appointmentType) {
      where.appointmentType = filters.appointmentType;
    }

    if (filters?.startDate) {
      where.startAt = { ...where.startAt as object, gte: new Date(filters.startDate) };
    }

    if (filters?.endDate) {
      where.startAt = { ...where.startAt as object, lte: new Date(filters.endDate) };
    }

    const slots = await this.db.appointmentSlot.findMany({
      where,
      orderBy: { startAt: 'asc' },
    });

    return { data: slots };
  }

  async createSlot(
    organizationId: string,
    requestingUserId: string,
    dto: CreateAppointmentSlotDto,
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const membership = user.memberships.find(
      (m) => m.organization.id === organizationId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization.');
    }

    const canManage = ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(
      membership.role.code,
    );

    if (!canManage && membership.role.code !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('You do not have permission to create slots.');
    }

    const organization = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    if (organization.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create slots for inactive organizations.');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (startAt >= endAt) {
      throw new BadRequestException('Slot end time must be after start time.');
    }

    if (startAt < new Date()) {
      throw new BadRequestException('Cannot create slots in the past.');
    }

    const slot = await this.db.appointmentSlot.create({
      data: {
        organizationId,
        appointmentType: dto.appointmentType,
        startAt,
        endAt,
        capacity: dto.capacity ?? 1,
        bookedCount: 0,
        status: SlotStatus.AVAILABLE,
      },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_SLOT_CREATED',
      entityType: 'AppointmentSlot',
      entityId: slot.id,
      organizationId,
      metadata: {
        appointmentType: dto.appointmentType,
        startAt: slot.startAt,
        endAt: slot.endAt,
        capacity: slot.capacity,
      },
      ipAddress,
    });

    return { data: slot };
  }

  async updateSlot(
    organizationId: string,
    slotId: string,
    requestingUserId: string,
    dto: UpdateAppointmentSlotDto,
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const membership = user.memberships.find(
      (m) => m.organization.id === organizationId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization.');
    }

    const canManage = ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(
      membership.role.code,
    );

    if (!canManage && membership.role.code !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('You do not have permission to update slots.');
    }

    const slot = await this.db.appointmentSlot.findFirst({
      where: { id: slotId, organizationId },
    });

    if (!slot) {
      throw new NotFoundException('Slot not found.');
    }

    if (slot.bookedCount > 0 && dto.capacity !== undefined && dto.capacity < slot.bookedCount) {
      throw new BadRequestException('Cannot reduce capacity below current booking count.');
    }

    const updated = await this.db.appointmentSlot.update({
      where: { id: slotId },
      data: {
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        capacity: dto.capacity,
        status: dto.status as SlotStatus,
      },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_SLOT_UPDATED',
      entityType: 'AppointmentSlot',
      entityId: slotId,
      organizationId,
      metadata: { changes: dto },
      ipAddress,
    });

    return { data: updated };
  }

  async blockSlot(
    organizationId: string,
    slotId: string,
    requestingUserId: string,
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const membership = user.memberships.find(
      (m) => m.organization.id === organizationId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization.');
    }

    const canManage = ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(
      membership.role.code,
    );

    if (!canManage && membership.role.code !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('You do not have permission to block slots.');
    }

    const slot = await this.db.appointmentSlot.findFirst({
      where: { id: slotId, organizationId },
    });

    if (!slot) {
      throw new NotFoundException('Slot not found.');
    }

    const updated = await this.db.appointmentSlot.update({
      where: { id: slotId },
      data: { status: SlotStatus.BLOCKED },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_SLOT_BLOCKED',
      entityType: 'AppointmentSlot',
      entityId: slotId,
      organizationId,
      ipAddress,
    });

    return { data: updated };
  }
}