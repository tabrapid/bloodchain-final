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
  LaboratoryResultStatus,
  Prisma,
  ResultFlag,
  RoleCode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { withUniqueRetry } from '../../common/utils/unique-retry.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BLOOD_TEST_COMPLETED_EVENT, BloodTestCompletedPayload } from '../gamification/events/gamification-event.handler';

/**
 * The in-range / out-of-range flag a result item carries when staff did not
 * type one.
 *
 * Every item used to be stored as NOT_AVAILABLE unless a flag was supplied by
 * hand, even though the reference range for the parameter had just been looked
 * up two lines above. The donor's Health screen reads this flag to decide
 * whether a value is highlighted, so a published result showed every number as
 * "no reference" -- the one thing a lab result is for. Staff's own flag still
 * wins; this only fills the blank.
 */
function deriveResultFlag(
  numericValue: number | null | undefined,
  referenceMin: Prisma.Decimal | null,
  referenceMax: Prisma.Decimal | null,
  rangeAppliesToThisParameter: boolean,
): ResultFlag {
  // A range that was defined for the whole test type says nothing about an
  // individual parameter, and comparing against it would produce a confidently
  // wrong LOW/HIGH -- a platelet count read against a haemoglobin range. No
  // flag is the honest answer there.
  if (!rangeAppliesToThisParameter) return ResultFlag.NOT_AVAILABLE;
  if (numericValue === undefined || numericValue === null) return ResultFlag.NOT_AVAILABLE;
  if (referenceMin === null && referenceMax === null) return ResultFlag.NOT_AVAILABLE;
  if (referenceMin !== null && numericValue < referenceMin.toNumber()) return ResultFlag.LOW;
  if (referenceMax !== null && numericValue > referenceMax.toNumber()) return ResultFlag.HIGH;
  return ResultFlag.NORMAL;
}

/**
 * The widest window `getAvailableDates` answers in one request.
 *
 * The donor calendar shows one month at a time and needs the leading/trailing
 * days of the neighbouring months to shade the grid, so two months is the
 * honest ceiling. It exists so a client cannot ask the database to group a
 * decade of slots by hand.
 */
export const MAX_AVAILABLE_DATES_RANGE_DAYS = 62;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` query parameter into local midnight.
 *
 * `new Date('2026-02-30')` silently rolls over to March 2nd, and
 * `new Date('2026-09-19')` is parsed as *UTC* midnight -- which lands on the
 * previous calendar day in any timezone west of Greenwich. Both produce a
 * calendar that quietly shades the wrong day, so the date is built from its
 * parts and checked for rollover.
 */
function parseCalendarDate(value: string, field: string): Date {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a calendar date in YYYY-MM-DD form.`);
  }

  const parts = value.split('-').map((part) => Number(part));
  const [year, month, day] = parts as [number, number, number];
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new BadRequestException(`${field} is not a real calendar date.`);
  }

  return parsed;
}

/** The `YYYY-MM-DD` key a slot's local start time belongs to. */
function calendarKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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
    // An organisation is a laboratory only if it has an *active* laboratory
    // profile. The filter used to be `laboratoryProfile?.isActive !== false`
    // applied after the query, which is true for an organisation that has no
    // profile at all -- so every hospital appeared in the list and then answered
    // "Laboratory is not active" when the donor tapped it.
    const where: Prisma.OrganizationWhereInput = {
      type: { in: ['BLOOD_CENTER', 'HOSPITAL'] },
      status: 'ACTIVE',
      laboratoryProfile: { isActive: true },
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

    return organizations;
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

  /**
   * The availability summary the donor's laboratory calendar needs, for a whole
   * range of dates in one request.
   *
   * The calendar used to fire one `GET /laboratories/:id/slots` per visible day
   * -- 21 requests to render one screen, every one of them returning full slot
   * rows the grid never showed. This returns only what shades a cell, and the
   * client still loads the exact slots when a date is picked.
   */
  async getAvailableDates(
    laboratoryId: string,
    testTypeId: string,
    from: string,
    to: string,
    userId: string,
  ) {
    const laboratory = await this.getLaboratory(laboratoryId, userId);
    const testType = await this.getTestType(testTypeId);

    // Same rule the booking call enforces: a laboratory that does not run the
    // panel has no availability for it, whatever its slot table says.
    const offersTestType = (laboratory.laboratoryProfile?.testTypes ?? []).some(
      (offered) => offered.id === testType.id,
    );

    if (!offersTestType) {
      throw new BadRequestException('This laboratory does not offer the selected test.');
    }

    const rangeStart = parseCalendarDate(from, 'from');
    const rangeEndDay = parseCalendarDate(to, 'to');

    if (rangeEndDay < rangeStart) {
      throw new BadRequestException('The end of the range must not be before its start.');
    }

    const dayCount =
      Math.round((rangeEndDay.getTime() - rangeStart.getTime()) / 86_400_000) + 1;

    if (dayCount > MAX_AVAILABLE_DATES_RANGE_DAYS) {
      throw new BadRequestException(
        `The range must cover at most ${MAX_AVAILABLE_DATES_RANGE_DAYS} days.`,
      );
    }

    const rangeEnd = new Date(rangeEndDay);
    rangeEnd.setHours(23, 59, 59, 999);

    const slots = await this.db.appointmentSlot.findMany({
      where: {
        organizationId: laboratoryId,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: { in: ['AVAILABLE', 'FULL'] },
        startAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true, startAt: true, capacity: true, bookedCount: true },
      orderBy: { startAt: 'asc' },
    });

    const appointments = await this.db.appointment.findMany({
      where: {
        organizationId: laboratoryId,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledStart: { gte: rangeStart, lte: rangeEnd },
      },
      select: { slotId: true },
    });

    const bookedSlotIds = new Set(appointments.map((appointment) => appointment.slotId));

    // Seed every day in the window so the calendar gets a gap-free series and
    // never has to guess whether a missing date means "closed" or "not loaded".
    const byDate = new Map<string, { date: string; totalSlots: number; availableSlots: number }>();
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEndDay) {
      const key = calendarKey(cursor);
      byDate.set(key, { date: key, totalSlots: 0, availableSlots: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const now = new Date();

    for (const slot of slots) {
      const bucket = byDate.get(calendarKey(slot.startAt));
      if (!bucket) continue;

      bucket.totalSlots += 1;

      // A slot that has already started cannot be booked, so counting it would
      // leave today looking open at 18:00 when the last appointment was at 09:00.
      const isBookable =
        slot.startAt > now && !bookedSlotIds.has(slot.id) && slot.bookedCount < slot.capacity;

      if (isBookable) {
        bucket.availableSlots += 1;
      }
    }

    return {
      laboratoryId,
      testTypeId,
      from: calendarKey(rangeStart),
      to: calendarKey(rangeEndDay),
      dates: Array.from(byDate.values()).map((bucket) => ({
        ...bucket,
        isAvailable: bucket.availableSlots > 0,
      })),
    };
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

    // The laboratory has to actually run the panel. Both were looked up
    // independently and never compared, so a request naming a valid laboratory
    // and a valid test type it does not offer booked successfully -- producing
    // exactly the appointment this whole flow exists to prevent: one the
    // laboratory cannot honour and has to phone the donor about.
    const offersTestType = (laboratory.laboratoryProfile?.testTypes ?? []).some(
      (offered) => offered.id === testType.id,
    );

    if (!offersTestType) {
      throw new BadRequestException('This laboratory does not offer the selected test.');
    }

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
              // Carry the donor's choice through to the laboratory. Previously
              // it was validated here and then dropped, so staff had to
              // re-select it at result entry.
              testTypeId: testType.id,
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
        // The panel the donor chose. Staff have had this since the booking
        // carried it; the donor's own list did not, so the app could only say
        // "blood test" back to the person who had picked one.
        testType: {
          select: { id: true, code: true, name: true, category: true },
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
        testType: {
          select: { id: true, code: true, name: true, category: true },
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
        // The booked test type, so the console can show what the donor chose
        // and default the result form to it instead of asking again.
        testType: {
          select: { id: true, code: true, name: true, category: true },
        },
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
    testTypeId?: string,
  ) {
    // Prisma silently omits an undefined filter field rather than matching
    // nothing, so a missing appointmentId here wouldn't 404 -- it would
    // match an arbitrary BLOOD_TEST appointment for this organization and
    // silently attach the result to the wrong donor. Guard explicitly
    // rather than rely on the id filter alone.
    if (!appointmentId) {
      throw new BadRequestException('appointmentId is required.');
    }

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

    // The test type now travels with the appointment, so staff do not have to
    // re-pick what the donor already chose. An explicit value still wins --
    // staff may legitimately have run a different panel -- but it cannot be
    // omitted for an appointment that never recorded one (the generic
    // POST /appointments path creates BLOOD_TEST appointments without a type).
    const effectiveTestTypeId = testTypeId ?? appointment.testTypeId;
    if (!effectiveTestTypeId) {
      throw new BadRequestException(
        'This appointment has no booked test type, so testTypeId must be supplied.',
      );
    }

    // Validates existence and that it is active, exactly as the booking path
    // does, so an explicit override cannot smuggle in an unknown type.
    await this.getTestType(effectiveTestTypeId);

    const result = await this.db.$transaction(async (tx) => {
      const labResult = await tx.laboratoryResult.create({
        data: {
          appointmentId,
          donorId: appointment.donorId,
          laboratoryId: organizationId,
          testTypeId: effectiveTestTypeId,
          status: LaboratoryResultStatus.ENTERED,
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
        let refRangeIsParameterScoped = false;

        if (parameter) {
          // Most specific range wins: this laboratory's range for this exact
          // parameter, then any laboratory's range for it, then the test
          // type's own range (which only makes sense for a single-parameter
          // test). Ordering by parameterId descending puts the rows that name
          // a parameter ahead of the ones that leave it null.
          const refRange = await tx.testReferenceRange.findFirst({
            where: {
              testTypeId: parameter.testTypeId,
              OR: [{ parameterId: item.parameterId }, { parameterId: null }],
              AND: [{ OR: [{ laboratoryId: organizationId }, { laboratoryId: null }] }],
              isActive: true,
            },
            orderBy: [{ parameterId: 'desc' }, { laboratoryId: 'desc' }],
          });

          if (refRange) {
            referenceMin = refRange.minValue;
            referenceMax = refRange.maxValue;
            refRangeIsParameterScoped = refRange.parameterId !== null;
          }
        }

        await tx.laboratoryResultItem.create({
          data: {
            resultId: labResult.id,
            parameterId: item.parameterId,
            value: item.value,
            // `item.numericValue` is a plain number off the request body here,
            // so a truthiness check silently discards a legitimate result of
            // 0 (an undetectable marker, a zero cell count) and stores null.
            // The two read paths are unaffected -- they see a Prisma.Decimal,
            // and Decimal(0) is a truthy object.
            numericValue:
              item.numericValue === undefined || item.numericValue === null
                ? null
                : new Prisma.Decimal(item.numericValue),
            unit: item.unit || parameter?.unit,
            referenceMin,
            referenceMax,
            flag: item.flag ?? deriveResultFlag(item.numericValue, referenceMin, referenceMax, refRangeIsParameterScoped),
            notes: item.notes,
          },
        });
      }

      await tx.laboratoryResultVersion.create({
        data: {
          resultId: labResult.id,
          version: 1,
          status: LaboratoryResultStatus.ENTERED,
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

    if (result.status !== LaboratoryResultStatus.ENTERED) {
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
          status: LaboratoryResultStatus.REVIEWED,
          reviewedAt: new Date(),
          reviewedBy: userId,
        },
      });

      await tx.laboratoryResultVersion.create({
        data: {
          resultId,
          version: (currentVersion?.version || 0) + 1,
          status: LaboratoryResultStatus.REVIEWED,
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

    if (result.status !== LaboratoryResultStatus.REVIEWED) {
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
          status: LaboratoryResultStatus.PUBLISHED,
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
          status: LaboratoryResultStatus.PUBLISHED,
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
      status: LaboratoryResultStatus.PUBLISHED,
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
    // Scoped to the caller in the query itself: a result belonging to another
    // donor must be indistinguishable from one that does not exist, or the
    // endpoint becomes an oracle that confirms result ids by probing them.
    const result = await this.db.laboratoryResult.findFirst({
      where: { id: resultId, donorId: userId },
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

    // The donor knows their own test exists -- they booked it -- so telling
    // them it is not published yet reveals nothing they did not already know.
    if (result.status !== LaboratoryResultStatus.PUBLISHED) {
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
          status: LaboratoryResultStatus.PUBLISHED,
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
