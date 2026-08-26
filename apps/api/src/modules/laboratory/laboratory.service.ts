import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Prisma,
  ResultFlag,
  RoleCode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { withUniqueRetry } from '../../common/utils/unique-retry.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BLOOD_TEST_COMPLETED_EVENT, BloodTestCompletedPayload } from '../gamification/events/gamification-event.handler';

@Injectable()
export class LaboratoryService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getTestTypes(filters?: { category?: string; isActive?: boolean }) {
    const where: Prisma.TestTypeWhereInput = {};
    if (filters?.category) {
      where.category = filters.category as any;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.db.testType.findMany({
      where,
      include: {
        parameters: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getTestType(testTypeId: string) {
    const testType = await this.db.testType.findUnique({
      where: { id: testTypeId },
      include: {
        parameters: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        referenceRanges: {
          where: { isActive: true },
        },
      },
    });

    if (!testType) {
      throw new NotFoundException('Test type not found.');
    }

    return testType;
  }

  async getLaboratories(organizationId?: string) {
    const where: Prisma.OrganizationWhereInput = {
      type: { in: ['BLOOD_CENTER', 'HOSPITAL'] },
      status: 'ACTIVE',
    };

    if (organizationId) {
      where.id = organizationId;
    }

    const organizations = await this.db.organization.findMany({
      where,
      include: {
        laboratoryProfile: {
          include: {
            testTypes: {
              where: { isActive: true },
              select: { id: true, code: true, name: true, category: true },
            },
          },
        },
      },
    });

    return organizations.filter((org) => org.laboratoryProfile?.isActive !== false);
  }

  async getLaboratory(laboratoryId: string, userId?: string) {
    const laboratory = await this.db.organization.findUnique({
      where: { id: laboratoryId },
      include: {
        laboratoryProfile: {
          include: {
            testTypes: {
              where: { isActive: true },
              include: {
                parameters: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!laboratory) {
      throw new NotFoundException('Laboratory not found.');
    }

    if (!laboratory.laboratoryProfile?.isActive) {
      throw new NotFoundException('Laboratory is not active.');
    }

    return laboratory;
  }

  async getAvailableSlots(
    laboratoryId: string,
    testTypeId: string,
    date: string,
    userId: string,
  ) {
    const laboratory = await this.getLaboratory(laboratoryId, userId);
    const testType = await this.getTestType(testTypeId);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const slots = await this.db.appointmentSlot.findMany({
      where: {
        organizationId: laboratoryId,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: { in: ['AVAILABLE', 'FULL'] },
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const existingAppointments = await this.db.appointment.findMany({
      where: {
        organizationId: laboratoryId,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledStart: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        slotId: true,
        scheduledStart: true,
      },
    });

    const bookedSlotIds = new Set(existingAppointments.map((a) => a.slotId));

    return slots.map((slot) => ({
      ...slot,
      isAvailable: !bookedSlotIds.has(slot.id) && slot.bookedCount < slot.capacity,
    }));
  }

  async bookLaboratoryAppointment(
    userId: string,
    laboratoryId: string,
    testTypeId: string,
    slotId: string,
    notes?: string,
  ) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        memberships: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.donorProfile) {
      throw new ForbiddenException('Only donors can book laboratory appointments.');
    }

    const laboratory = await this.getLaboratory(laboratoryId, userId);
    const testType = await this.getTestType(testTypeId);

    const slot = await this.db.appointmentSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundException('Slot not found.');
    }

    if (slot.organizationId !== laboratoryId) {
      throw new BadRequestException('Slot does not belong to this laboratory.');
    }

    if (slot.appointmentType !== AppointmentType.BLOOD_TEST) {
      throw new BadRequestException('Slot is not for blood tests.');
    }

    if (slot.status !== 'AVAILABLE') {
      throw new BadRequestException('Slot is not available.');
    }

    if (slot.bookedCount >= slot.capacity) {
      throw new BadRequestException('Slot is fully booked.');
    }

    const existingAppointment = await this.db.appointment.findFirst({
      where: {
        donorId: userId,
        slotId: slotId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    if (existingAppointment) {
      throw new BadRequestException('You already have an appointment for this slot.');
    }

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
          // Atomic conditional update: only succeeds if the slot is still
          // AVAILABLE and under capacity at the moment Postgres acquires the row
          // lock, closing the race window between the pre-checks above and this
          // transaction — mirrors the same fix in appointments.service.ts, since
          // both booking paths share the AppointmentSlot table.
          const claim = await tx.appointmentSlot.updateMany({
            where: { id: slotId, status: 'AVAILABLE', bookedCount: { lt: slot.capacity } },
            data: { bookedCount: { increment: 1 } },
          });

          if (claim.count === 0) {
            throw new BadRequestException('Slot is fully booked.');
          }

          const referenceNumber = `LAB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;

          const appointment = await tx.appointment.create({
            data: {
              referenceNumber,
              donorId: userId,
              organizationId: laboratoryId,
              slotId: slotId,
              appointmentType: AppointmentType.BLOOD_TEST,
              status: AppointmentStatus.PENDING,
              scheduledStart: slot.startAt,
              scheduledEnd: slot.endAt,
              notes,
            },
          });

          const updatedSlot = await tx.appointmentSlot.findUniqueOrThrow({
            where: { id: slotId },
            select: { bookedCount: true, capacity: true },
          });

          if (updatedSlot.bookedCount >= updatedSlot.capacity) {
            await tx.appointmentSlot.update({
              where: { id: slotId },
              data: { status: 'FULL' },
            });
          }

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              action: 'BOOKED',
              newStatus: AppointmentStatus.PENDING,
              actorId: userId,
            },
          });

          return appointment;
        }),
      { uniqueFields: ['referenceNumber'] },
    );

    await this.audit.log({
      actorId: userId,
      action: 'LAB_APPOINTMENT_BOOKED',
      entityType: 'Appointment',
      entityId: result.id,
      organizationId: laboratoryId,
      metadata: {
        referenceNumber: result.referenceNumber,
        testType: testType.code,
      },
    });

    return result;
  }

  async getDonorAppointments(
    userId: string,
    filters?: {
      status?: string;
      laboratoryId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: Prisma.AppointmentWhereInput = {
      donorId: userId,
      appointmentType: AppointmentType.BLOOD_TEST,
    };

    if (filters?.status) {
      where.status = filters.status as AppointmentStatus;
    }

    if (filters?.laboratoryId) {
      where.organizationId = filters.laboratoryId;
    }

    if (filters?.startDate) {
      where.scheduledStart = {
        ...((where.scheduledStart as any) || {}),
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.scheduledEnd = {
        ...((where.scheduledEnd as any) || {}),
        lte: new Date(filters.endDate),
      };
    }

    return this.db.appointment.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true, address: true },
        },
        laboratoryResult: {
          select: {
            id: true,
            status: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { scheduledStart: 'desc' },
    });
  }

  async getDonorAppointment(userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        donorId: userId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
      include: {
        organization: {
          select: { id: true, name: true, address: true },
        },
        laboratoryResult: {
          include: {
            testType: {
              select: { id: true, code: true, name: true },
            },
            items: {
              include: {
                parameter: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    return appointment;
  }

  async getLaboratoryAppointments(
    organizationId: string,
    userId: string,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    const membership = await this.db.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this organization.');
    }

    const allowedRoles: RoleCode[] = [
      RoleCode.BLOOD_CENTER_ADMIN,
      RoleCode.BLOOD_CENTER_STAFF,
      RoleCode.HOSPITAL_ADMIN,
      RoleCode.HOSPITAL_STAFF,
      RoleCode.LAB_TECHNICIAN,
      RoleCode.LAB_REVIEWER,
      RoleCode.LAB_ADMIN,
      RoleCode.SUPER_ADMIN,
    ];
    const canAccess = allowedRoles.includes(membership.role.code as RoleCode);

    if (!canAccess) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const where: Prisma.AppointmentWhereInput = {
      organizationId,
      appointmentType: AppointmentType.BLOOD_TEST,
    };

    if (filters?.status) {
      where.status = filters.status as AppointmentStatus;
    }

    if (filters?.startDate) {
      where.scheduledStart = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.scheduledEnd = {
        lte: new Date(filters.endDate),
      };
    }

    if (filters?.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
        { donor: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { donor: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { donor: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return this.db.appointment.findMany({
      where,
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            donorProfile: {
              select: {
                bloodType: true,
                rhFactor: true,
              },
            },
          },
        },
        laboratoryResult: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { scheduledStart: 'desc' },
    });
  }

  async confirmAppointment(organizationId: string, userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Only pending appointments can be confirmed.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CONFIRMED },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'CONFIRMED',
          previousStatus: AppointmentStatus.PENDING,
          newStatus: AppointmentStatus.CONFIRMED,
          actorId: userId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_APPOINTMENT_CONFIRMED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId,
    });

    return result;
  }

  async checkInAppointment(organizationId: string, userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed appointments can be checked in.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'CHECKED_IN',
          previousStatus: AppointmentStatus.CONFIRMED,
          newStatus: AppointmentStatus.CHECKED_IN,
          actorId: userId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_CHECKED_IN',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId,
    });

    return result;
  }

  async startTest(organizationId: string, userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.status !== AppointmentStatus.CHECKED_IN) {
      throw new BadRequestException('Only checked in appointments can be started.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.IN_PROGRESS },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'TEST_STARTED',
          previousStatus: AppointmentStatus.CHECKED_IN,
          newStatus: AppointmentStatus.IN_PROGRESS,
          actorId: userId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_TEST_STARTED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId,
    });

    return result;
  }

  async completeAppointment(organizationId: string, userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException('Only appointments in progress can be completed.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.RESULT_PENDING },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'COMPLETED',
          previousStatus: AppointmentStatus.IN_PROGRESS,
          newStatus: AppointmentStatus.RESULT_PENDING,
          actorId: userId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_APPOINTMENT_COMPLETED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId,
    });

    return result;
  }

  async createResult(
    organizationId: string,
    userId: string,
    appointmentId: string,
    data: {
      items: Array<{
        parameterId: string;
        value: string;
        numericValue?: number;
        unit?: string;
        flag?: ResultFlag;
        notes?: string;
      }>;
    },
    testTypeId: string,
  ) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
      include: {
        laboratoryResult: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.status !== AppointmentStatus.RESULT_PENDING) {
      throw new BadRequestException('Result can only be created for appointments awaiting results.');
    }

    if (appointment.laboratoryResult) {
      throw new BadRequestException('Result already exists for this appointment.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const labResult = await tx.laboratoryResult.create({
        data: {
          appointmentId,
          donorId: appointment.donorId,
          laboratoryId: organizationId,
          testTypeId,
          status: 'ENTERED',
          performedAt: new Date(),
          performedBy: userId,
        },
      });

      for (const item of data.items) {
        const parameter = await tx.testParameter.findUnique({
          where: { id: item.parameterId },
        });

        let referenceMin: Prisma.Decimal | null = null;
        let referenceMax: Prisma.Decimal | null = null;

        if (parameter) {
          const refRange = await tx.testReferenceRange.findFirst({
            where: {
              testTypeId: parameter.testTypeId,
              OR: [
                { laboratoryId: organizationId },
                { laboratoryId: null },
              ],
              isActive: true,
            },
          });

          if (refRange) {
            referenceMin = refRange.minValue;
            referenceMax = refRange.maxValue;
          }
        }

        await tx.laboratoryResultItem.create({
          data: {
            resultId: labResult.id,
            parameterId: item.parameterId,
            value: item.value,
            numericValue: item.numericValue ? new Prisma.Decimal(item.numericValue) : null,
            unit: item.unit || parameter?.unit,
            referenceMin,
            referenceMax,
            flag: item.flag || ResultFlag.NOT_AVAILABLE,
            notes: item.notes,
          },
        });
      }

      await tx.laboratoryResultVersion.create({
        data: {
          resultId: labResult.id,
          version: 1,
          status: 'ENTERED',
          changedBy: userId,
        },
      });

      return labResult;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_RESULT_CREATED',
      entityType: 'LaboratoryResult',
      entityId: result.id,
      organizationId,
    });

    return result;
  }

  async getResult(organizationId: string, userId: string, resultId: string) {
    const result = await this.db.laboratoryResult.findUnique({
      where: { id: resultId },
      include: {
        testType: true,
        items: {
          include: {
            parameter: true,
          },
          orderBy: {
            parameter: {
              displayOrder: 'asc',
            },
          },
        },
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Result not found.');
    }

    if (result.laboratoryId !== organizationId) {
      throw new ForbiddenException('Access denied.');
    }

    return result;
  }

  async reviewResult(organizationId: string, userId: string, resultId: string) {
    const result = await this.db.laboratoryResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new NotFoundException('Result not found.');
    }

    if (result.laboratoryId !== organizationId) {
      throw new ForbiddenException('Access denied.');
    }

    if (result.status !== 'ENTERED') {
      throw new BadRequestException('Only entered results can be reviewed.');
    }

    const currentVersion = await this.db.laboratoryResultVersion.findFirst({
      where: { resultId },
      orderBy: { version: 'desc' },
    });

    const updated = await this.db.$transaction(async (tx) => {
      const newResult = await tx.laboratoryResult.update({
        where: { id: resultId },
        data: {
          status: 'REVIEWED',
          reviewedAt: new Date(),
          reviewedBy: userId,
        },
      });

      await tx.laboratoryResultVersion.create({
        data: {
          resultId,
          version: (currentVersion?.version || 0) + 1,
          status: 'REVIEWED',
          changedBy: userId,
        },
      });

      return newResult;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_RESULT_REVIEWED',
      entityType: 'LaboratoryResult',
      entityId: resultId,
      organizationId,
    });

    return updated;
  }

  async publishResult(organizationId: string, userId: string, resultId: string) {
    const result = await this.db.laboratoryResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new NotFoundException('Result not found.');
    }

    if (result.laboratoryId !== organizationId) {
      throw new ForbiddenException('Access denied.');
    }

    if (result.status !== 'REVIEWED') {
      throw new BadRequestException('Only reviewed results can be published.');
    }

    const currentVersion = await this.db.laboratoryResultVersion.findFirst({
      where: { resultId },
      orderBy: { version: 'desc' },
    });

    const updated = await this.db.$transaction(async (tx) => {
      const newResult = await tx.laboratoryResult.update({
        where: { id: resultId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedBy: userId,
        },
      });

      await tx.appointment.update({
        where: { id: result.appointmentId },
        data: { status: AppointmentStatus.RESULT_PUBLISHED },
      });

      await tx.laboratoryResultVersion.create({
        data: {
          resultId,
          version: (currentVersion?.version || 0) + 1,
          status: 'PUBLISHED',
          changedBy: userId,
        },
      });

      return newResult;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_RESULT_PUBLISHED',
      entityType: 'LaboratoryResult',
      entityId: resultId,
      organizationId,
    });

    this.eventEmitter.emit(BLOOD_TEST_COMPLETED_EVENT, {
      resultId: resultId,
      donorId: result.donorId,
    } as BloodTestCompletedPayload);

    return updated;
  }

  async getDonorResults(userId: string, filters?: { testTypeId?: string; startDate?: string; endDate?: string }) {
    const where: Prisma.LaboratoryResultWhereInput = {
      donorId: userId,
      status: 'PUBLISHED',
    };

    if (filters?.testTypeId) {
      where.testTypeId = filters.testTypeId;
    }

    if (filters?.startDate) {
      where.publishedAt = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.publishedAt = {
        ...((where.publishedAt as any) || {}),
        lte: new Date(filters.endDate),
      };
    }

    return this.db.laboratoryResult.findMany({
      where,
      include: {
        testType: {
          select: { id: true, code: true, name: true, category: true },
        },
        laboratory: {
          select: { id: true, name: true, address: true },
        },
        items: {
          include: {
            parameter: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getDonorResult(userId: string, resultId: string) {
    const result = await this.db.laboratoryResult.findUnique({
      where: { id: resultId },
      include: {
        testType: true,
        laboratory: {
          select: { id: true, name: true, address: true },
        },
        items: {
          include: {
            parameter: true,
          },
          orderBy: {
            parameter: {
              displayOrder: 'asc',
            },
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Result not found.');
    }

    if (result.donorId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    if (result.status !== 'PUBLISHED') {
      throw new ForbiddenException('Result is not yet published.');
    }

    return result;
  }

  async cancelAppointment(userId: string, appointmentId: string, reason?: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        donorId: userId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (['CANCELLED', 'NO_SHOW', 'COMPLETED', 'RESULT_PUBLISHED'].includes(appointment.status)) {
      throw new BadRequestException('Appointment cannot be cancelled.');
    }

    const appointmentTime = new Date(appointment.scheduledStart).getTime();
    const now = Date.now();
    const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 2) {
      throw new BadRequestException('Cannot cancel within 2 hours of appointment.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      });

      await tx.appointmentSlot.update({
        where: { id: appointment.slotId },
        data: { bookedCount: { decrement: 1 } },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'CANCELLED',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.CANCELLED,
          actorId: userId,
          reason,
        },
      });

      // A cancellation frees a seat, so a slot that was FULL may have room
      // again — mirrors the equivalent fix in appointments.service.ts,
      // since both booking paths share the AppointmentSlot table.
      const slot = await tx.appointmentSlot.findUnique({
        where: { id: appointment.slotId },
      });

      if (slot && slot.status === 'FULL' && slot.bookedCount < slot.capacity) {
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { status: 'AVAILABLE' },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_APPOINTMENT_CANCELLED',
      entityType: 'Appointment',
      entityId: appointmentId,
      metadata: { reason },
    });

    return result;
  }

  async markNoShow(organizationId: string, userId: string, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (!['CONFIRMED', 'PENDING'].includes(appointment.status)) {
      throw new BadRequestException('Only confirmed or pending appointments can be marked as no-show.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.NO_SHOW },
      });

      await tx.appointmentSlot.update({
        where: { id: appointment.slotId },
        data: { bookedCount: { decrement: 1 } },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'NO_SHOW',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.NO_SHOW,
          actorId: userId,
        },
      });

      // A no-show frees a seat too — same FULL-to-AVAILABLE reset as
      // cancelAppointment above.
      const slot = await tx.appointmentSlot.findUnique({
        where: { id: appointment.slotId },
      });

      if (slot && slot.status === 'FULL' && slot.bookedCount < slot.capacity) {
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { status: 'AVAILABLE' },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: userId,
      action: 'LAB_NO_SHOW',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId,
    });

    return result;
  }

  async getParameterTrend(
    userId: string,
    parameterId: string,
    options?: { startDate?: string; endDate?: string; limit?: number },
  ) {
    const items = await this.db.laboratoryResultItem.findMany({
      where: {
        parameterId,
        result: {
          donorId: userId,
          status: 'PUBLISHED',
        },
      },
      include: {
        result: {
          select: {
            publishedAt: true,
            laboratory: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        result: {
          publishedAt: 'asc',
        },
      },
      take: options?.limit || 10,
    });

    return items.map((item) => ({
      value: item.value,
      numericValue: item.numericValue ? parseFloat(item.numericValue.toString()) : null,
      unit: item.unit,
      flag: item.flag,
      date: item.result.publishedAt,
      laboratory: item.result.laboratory.name,
    }));
  }
}
