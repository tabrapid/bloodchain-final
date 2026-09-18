import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, AppointmentType, Prisma, RoleCode, SlotStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateAppointmentDto,
  CancelAppointmentDto,
  ListOrganizationAppointmentsDto,
  RescheduleAppointmentDto,
  GetMyAppointmentsDto,
} from './dto/appointment.dto';
import { APPOINTMENT_COMPLETED_EVENT } from '../gamification/events/gamification-event.handler';
import {
  APPOINTMENT_CANCELLED_EVENT,
  APPOINTMENT_CREATED_EVENT,
} from '../notifications/appointment-notification.events';
import { assertOrganizationActive } from '../../common/utils/organization-status.util';
import { withUniqueRetry } from '../../common/utils/unique-retry.util';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';

const REFERENCE_PREFIX: Record<AppointmentType, string> = {
  [AppointmentType.BLOOD_DONATION]: 'DON',
  [AppointmentType.BLOOD_TEST]: 'LAB',
  [AppointmentType.CONSULTATION]: 'CON',
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly donationEligibility: DonationEligibilityService,
  ) {}

  /**
   * Appointment references are prefixed by what the appointment is for.
   *
   * Every booking made here was labelled DON- regardless of type, so a blood
   * test booked from the app arrived in the laboratory console as DON-2026-…
   * while the ones the laboratory books itself read LAB-2026-… -- two naming
   * schemes for one queue, and staff reading down a list for a donor's
   * reference cannot tell which is which.
   */
  private generateReferenceNumber(appointmentType: AppointmentType): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    const prefix = REFERENCE_PREFIX[appointmentType] ?? 'APT';
    return `${prefix}-${year}-${random}`;
  }

  async bookAppointment(
    donorId: string,
    dto: CreateAppointmentDto,
    ipAddress?: string,
  ) {
    const donor = await this.db.user.findUnique({
      where: { id: donorId },
      include: {
        donorProfile: true,
        memberships: { where: { status: 'ACTIVE' }, include: { role: true } },
      },
    });

    if (!donor) {
      throw new NotFoundException('User not found.');
    }

    if (donor.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active.');
    }

    const slot = await this.db.appointmentSlot.findUnique({
      where: { id: dto.slotId },
      include: { organization: true },
    });

    if (!slot) {
      throw new NotFoundException('Appointment slot not found.');
    }

    assertOrganizationActive(slot.organization);

    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new ConflictException('This slot is no longer available.');
    }

    if (slot.bookedCount >= slot.capacity) {
      throw new ConflictException('This slot is fully booked.');
    }

    if (slot.startAt < new Date()) {
      throw new BadRequestException('Cannot book a slot in the past.');
    }

    if (slot.appointmentType !== dto.appointmentType) {
      throw new BadRequestException('Appointment type does not match the slot.');
    }

    // The recovery window was enforced in exactly one place -- accepting an
    // emergency -- while the ordinary booking path checked nothing. The next
    // eligible date was computed and shown to donors, and then not applied, so
    // a donor who gave blood yesterday could book and complete another
    // donation today. The rule itself is unchanged: this is the existing
    // service, asked about the right moment.
    //
    // Asked about the slot's start, not now: a donor three days from the end of
    // their window may legitimately book a slot next week, and refusing that
    // would be a new restriction rather than enforcement of the existing one.
    // Only blood donation is gated -- a laboratory test or a consultation is
    // not a donation and carries no recovery window.
    if (dto.appointmentType === AppointmentType.BLOOD_DONATION) {
      await this.donationEligibility.assertEligibleToDonateAt(donorId, slot.startAt);
    }

    const conflictingAppointment = await this.db.appointment.findFirst({
      where: {
        donorId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        OR: [
          {
            scheduledStart: { lte: slot.startAt },
            scheduledEnd: { gt: slot.startAt },
          },
          {
            scheduledStart: { lt: slot.endAt },
            scheduledEnd: { gte: slot.endAt },
          },
          {
            scheduledStart: { gte: slot.startAt },
            scheduledEnd: { lte: slot.endAt },
          },
        ],
      },
    });

    if (conflictingAppointment) {
      throw new ConflictException('You already have an appointment at this time.');
    }

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
          // Atomic conditional update: only succeeds if the slot is still AVAILABLE
          // and under capacity at the moment Postgres acquires the row lock,
          // closing the race window between the pre-checks above and this
          // transaction — two concurrent bookings for the last seat can no longer
          // both win.
          const claim = await tx.appointmentSlot.updateMany({
            where: { id: slot.id, status: SlotStatus.AVAILABLE, bookedCount: { lt: slot.capacity } },
            data: { bookedCount: { increment: 1 } },
          });

          if (claim.count === 0) {
            throw new ConflictException('This slot is no longer available.');
          }

          const referenceNumber = this.generateReferenceNumber(dto.appointmentType);

          const appointment = await tx.appointment.create({
            data: {
              referenceNumber,
              donorId,
              organizationId: slot.organizationId,
              slotId: slot.id,
              appointmentType: slot.appointmentType,
              status: AppointmentStatus.PENDING,
              scheduledStart: slot.startAt,
              scheduledEnd: slot.endAt,
              notes: dto.notes,
            },
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

          const updatedSlot = await tx.appointmentSlot.findUniqueOrThrow({
            where: { id: slot.id },
            select: { bookedCount: true, capacity: true },
          });

          if (updatedSlot.bookedCount >= updatedSlot.capacity) {
            await tx.appointmentSlot.update({
              where: { id: slot.id },
              data: { status: SlotStatus.FULL },
            });
          }

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              action: 'CREATED',
              newStatus: AppointmentStatus.PENDING,
              actorId: donorId,
              metadata: { referenceNumber },
            },
          });

          return appointment;
        }),
      { uniqueFields: ['referenceNumber'] },
    );

    await this.audit.log({
      actorId: donorId,
      action: 'APPOINTMENT_BOOKED',
      entityType: 'Appointment',
      entityId: result.id,
      organizationId: slot.organizationId,
      metadata: {
        referenceNumber: result.referenceNumber,
        appointmentType: slot.appointmentType,
        scheduledStart: slot.startAt,
        scheduledEnd: slot.endAt,
      },
      ipAddress,
    });

    // The donor is told they are booked, in the app, on a persisted
    // notification -- not only by the screen they happen to be looking at.
    // The handler is the one the notifications module already had; nothing
    // emitted this event, so the handler had never run in production.
    this.eventEmitter.emit(APPOINTMENT_CREATED_EVENT, {
      appointmentId: result.id,
      scheduledAt: result.scheduledStart,
      recipientIds: [donorId],
    });

    return {
      data: {
        id: result.id,
        referenceNumber: result.referenceNumber,
        appointmentType: result.appointmentType,
        status: result.status,
        scheduledStart: result.scheduledStart,
        scheduledEnd: result.scheduledEnd,
        notes: result.notes,
        organization: result.organization,
      },
    };
  }

  async getMyAppointments(donorId: string, filters: GetMyAppointmentsDto) {
    const where: Prisma.AppointmentWhereInput = { donorId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.appointmentType) {
      where.appointmentType = filters.appointmentType;
    }

    if (filters.upcoming === 'true') {
      where.scheduledStart = { gte: new Date() };
      where.status = { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] };
    } else if (filters.past === 'true') {
      where.scheduledEnd = { lt: new Date() };
    } else if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.scheduledStart = { gte: startOfDay, lte: endOfDay };
    }

    const appointments = await this.db.appointment.findMany({
      where,
      orderBy: { scheduledStart: filters.past === 'true' ? 'desc' : 'asc' },
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

    return {
      data: appointments.map((apt) => ({
        id: apt.id,
        referenceNumber: apt.referenceNumber,
        appointmentType: apt.appointmentType,
        status: apt.status,
        scheduledStart: apt.scheduledStart,
        scheduledEnd: apt.scheduledEnd,
        notes: apt.notes,
        organization: apt.organization,
      })),
    };
  }

  async getAppointmentById(appointmentId: string, requestingUserId: string) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        // Only a blood test carries one, and it is the one thing the donor
        // chose that the detail screen could not name.
        testType: {
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.donorId !== requestingUserId) {
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
        throw new ForbiddenException('Access denied.');
      }

      const isStaff = user.memberships.some(
        (m) =>
          m.organization.id === appointment.organizationId &&
          ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
      );

      const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

      if (!isStaff && !isSuperAdmin) {
        throw new ForbiddenException('You do not have permission to view this appointment.');
      }
    }

    return { data: appointment };
  }

  async cancelAppointment(
    appointmentId: string,
    donorId: string,
    dto: CancelAppointmentDto,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.donorId !== donorId) {
      throw new ForbiddenException('You can only cancel your own appointments.');
    }

    const cancellableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] as const;
    if (!cancellableStatuses.includes(appointment.status as typeof cancellableStatuses[number])) {
      throw new BadRequestException('This appointment cannot be cancelled.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
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
          actorId: donorId,
          reason: dto.reason,
        },
      });

      const slot = await tx.appointmentSlot.findUnique({
        where: { id: appointment.slotId },
      });

      if (slot && slot.status === SlotStatus.FULL && slot.bookedCount < slot.capacity) {
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { status: SlotStatus.AVAILABLE },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: donorId,
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      metadata: {
        referenceNumber: appointment.referenceNumber,
        reason: dto.reason,
        previousStatus: appointment.status,
      },
      ipAddress,
    });

    this.eventEmitter.emit(APPOINTMENT_CANCELLED_EVENT, {
      appointmentId: result.id,
      scheduledAt: appointment.scheduledStart,
      recipientIds: [donorId],
    });

    return { data: { id: result.id, status: result.status } };
  }

  async rescheduleAppointment(
    appointmentId: string,
    donorId: string,
    dto: RescheduleAppointmentDto,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
      include: { slot: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.donorId !== donorId) {
      throw new ForbiddenException('You can only reschedule your own appointments.');
    }

    const reschedulableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] as const;
    if (!reschedulableStatuses.includes(appointment.status as typeof reschedulableStatuses[number])) {
      throw new BadRequestException('This appointment cannot be rescheduled.');
    }

    const newSlot = await this.db.appointmentSlot.findUnique({
      where: { id: dto.newSlotId },
    });

    if (!newSlot) {
      throw new NotFoundException('New slot not found.');
    }

    if (newSlot.status !== SlotStatus.AVAILABLE) {
      throw new ConflictException('The new slot is not available.');
    }

    if (newSlot.bookedCount >= newSlot.capacity) {
      throw new ConflictException('The new slot is fully booked.');
    }

    if (newSlot.startAt < new Date()) {
      throw new BadRequestException('Cannot reschedule to a slot in the past.');
    }

    // Rescheduling moves the date the donation would happen, so the window has
    // to be re-checked against the new slot -- otherwise a donation booked
    // legitimately could be moved into the donor's recovery window and the
    // check at booking would have been pointless.
    if (appointment.appointmentType === AppointmentType.BLOOD_DONATION) {
      await this.donationEligibility.assertEligibleToDonateAt(donorId, newSlot.startAt);
    }

    const conflictingAppointment = await this.db.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        donorId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        OR: [
          {
            scheduledStart: { lte: newSlot.startAt },
            scheduledEnd: { gt: newSlot.startAt },
          },
          {
            scheduledStart: { lt: newSlot.endAt },
            scheduledEnd: { gte: newSlot.endAt },
          },
          {
            scheduledStart: { gte: newSlot.startAt },
            scheduledEnd: { lte: newSlot.endAt },
          },
        ],
      },
    });

    if (conflictingAppointment) {
      throw new ConflictException('You already have another appointment at this time.');
    }

    const result = await this.db.$transaction(async (tx) => {
      // Same atomic conditional claim as bookAppointment, done first so a
      // lost race fails fast without touching the appointment or old slot:
      // closes the window between the pre-checks above and this transaction
      // for the new slot.
      const claim = await tx.appointmentSlot.updateMany({
        where: { id: newSlot.id, status: SlotStatus.AVAILABLE, bookedCount: { lt: newSlot.capacity } },
        data: { bookedCount: { increment: 1 } },
      });

      if (claim.count === 0) {
        throw new ConflictException('The new slot is no longer available.');
      }

      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          slotId: newSlot.id,
          scheduledStart: newSlot.startAt,
          scheduledEnd: newSlot.endAt,
          status: AppointmentStatus.RESCHEDULED,
        },
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

      await tx.appointmentSlot.update({
        where: { id: appointment.slotId },
        data: { bookedCount: { decrement: 1 } },
      });

      const oldSlot = await tx.appointmentSlot.findUnique({
        where: { id: appointment.slotId },
      });

      if (oldSlot && oldSlot.status === SlotStatus.FULL && oldSlot.bookedCount < oldSlot.capacity) {
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { status: SlotStatus.AVAILABLE },
        });
      }

      const updatedNewSlot = await tx.appointmentSlot.findUniqueOrThrow({
        where: { id: newSlot.id },
        select: { bookedCount: true, capacity: true },
      });

      if (updatedNewSlot.bookedCount >= updatedNewSlot.capacity) {
        await tx.appointmentSlot.update({
          where: { id: newSlot.id },
          data: { status: SlotStatus.FULL },
        });
      }

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'RESCHEDULED',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.RESCHEDULED,
          actorId: donorId,
          metadata: {
            oldSlotId: appointment.slotId,
            newSlotId: newSlot.id,
            oldStart: appointment.scheduledStart,
            newStart: newSlot.startAt,
          },
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: donorId,
      action: 'APPOINTMENT_RESCHEDULED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      metadata: {
        referenceNumber: appointment.referenceNumber,
        oldSlotId: appointment.slotId,
        newSlotId: newSlot.id,
      },
      ipAddress,
    });

    return {
      data: {
        id: result.id,
        referenceNumber: result.referenceNumber,
        appointmentType: result.appointmentType,
        status: result.status,
        scheduledStart: result.scheduledStart,
        scheduledEnd: result.scheduledEnd,
        organization: result.organization,
      },
    };
  }

  async confirmAppointment(
    appointmentId: string,
    requestingUserId: string,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

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
      (m) =>
        m.organization.id === appointment.organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );

    if (!membership) {
      throw new ForbiddenException('Only staff can confirm appointments.');
    }

    assertOrganizationActive(membership.organization);

    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Only pending appointments can be confirmed.');
    }

    const updated = await this.db.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CONFIRMED },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_CONFIRMED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      ipAddress,
    });

    return { data: { id: updated.id, status: updated.status } };
  }

  async completeAppointment(
    appointmentId: string,
    requestingUserId: string,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

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
      (m) =>
        m.organization.id === appointment.organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );

    if (!membership) {
      throw new ForbiddenException('Only staff can complete appointments.');
    }

    assertOrganizationActive(membership.organization);

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed appointments can be completed.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'COMPLETED',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.COMPLETED,
          actorId: requestingUserId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_COMPLETED',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      ipAddress,
    });

    this.eventEmitter.emit(APPOINTMENT_COMPLETED_EVENT, {
      appointmentId,
      donorId: appointment.donorId,
    });

    return { data: { id: result.id, status: result.status } };
  }


  /**
   * The roles that run an appointment desk.
   *
   * Written once instead of being retyped at each staff action -- confirm and
   * complete each carried their own copy of this array, and a lifecycle
   * action added later would have carried a third.
   */
  private static readonly DESK_ROLES = [
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  ] as const;

  /**
   * Confirms the caller works, right now, at the organisation the appointment
   * belongs to -- and that the organisation is still active.
   */
  private async assertDeskStaff(userId: string, organizationId: string, action: string) {
    const membership = await this.db.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: { code: { in: AppointmentsService.DESK_ROLES as unknown as RoleCode[] } },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new ForbiddenException(`Only staff of this organization can ${action}.`);
    }

    assertOrganizationActive(membership.organization);
    return membership;
  }

  /**
   * The appointments one organisation's desk has booked.
   *
   * Staff could create, edit and block *slots*, and could confirm an
   * appointment whose id they already had -- but there was no route that
   * listed the appointments themselves, so nothing in any portal could show
   * who was actually coming in. That is the list.
   */
  async listOrganizationAppointments(
    organizationId: string,
    requestingUserId: string,
    filters: ListOrganizationAppointmentsDto = {},
  ) {
    await this.assertDeskStaff(requestingUserId, organizationId, 'view appointments');

    const where: Prisma.AppointmentWhereInput = { organizationId };

    if (filters.status) where.status = filters.status as AppointmentStatus;
    if (filters.appointmentType) {
      where.appointmentType = filters.appointmentType as AppointmentType;
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.scheduledStart = { gte: start, lte: end };
    } else if (filters.startDate || filters.endDate) {
      where.scheduledStart = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { donor: { firstName: { contains: search, mode: 'insensitive' } } },
        { donor: { lastName: { contains: search, mode: 'insensitive' } } },
        { donor: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const limit = Math.min(Number(filters.limit) || 50, 200);

    const appointments = await this.db.appointment.findMany({
      where,
      take: limit,
      orderBy: { scheduledStart: 'asc' },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            donorProfile: {
              select: { bloodType: true, rhFactor: true, verificationStatus: true },
            },
          },
        },
        // Present on blood tests only, and the thing staff otherwise have to
        // telephone the donor to ask.
        testType: { select: { id: true, code: true, name: true } },
        slot: { select: { id: true, capacity: true, bookedCount: true } },
      },
    });

    return { data: appointments };
  }

  /**
   * The donor did not come.
   *
   * A no-show is a terminal state, and it returns the seat: the slot's
   * bookedCount is decremented and a FULL slot goes back to AVAILABLE, exactly
   * as a cancellation does. Without that, an unattended appointment held a seat
   * nobody could book for the rest of the slot's life.
   */
  async markNoShow(
    appointmentId: string,
    requestingUserId: string,
    reason?: string,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    await this.assertDeskStaff(requestingUserId, appointment.organizationId, 'mark a no-show');

    const markable: AppointmentStatus[] = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
    ];

    if (!markable.includes(appointment.status)) {
      throw new BadRequestException('This appointment cannot be marked as a no-show.');
    }

    if (appointment.scheduledStart > new Date()) {
      throw new BadRequestException(
        'This appointment has not started yet, so it cannot be a no-show.',
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.NO_SHOW },
      });

      await this.releaseSeat(tx, appointment.slotId);

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'NO_SHOW',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.NO_SHOW,
          actorId: requestingUserId,
          reason,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_NO_SHOW',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      metadata: { reason },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status } };
  }

  /**
   * Staff cancel an appointment on the donor's behalf.
   *
   * `cancelAppointment` above is the donor's own route and refuses anyone but
   * the donor, which is right: this is the separate, audited path for the desk
   * closing a session or turning a booking away, and it notifies the donor
   * through the same cancellation event their own cancellation raises.
   */
  async cancelAppointmentAsStaff(
    appointmentId: string,
    requestingUserId: string,
    reason: string,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    await this.assertDeskStaff(requestingUserId, appointment.organizationId, 'cancel appointments');

    const cancellable: AppointmentStatus[] = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
    ];

    if (!cancellable.includes(appointment.status)) {
      throw new BadRequestException('This appointment cannot be cancelled.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.releaseSeat(tx, appointment.slotId);

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          action: 'CANCELLED',
          previousStatus: appointment.status,
          newStatus: AppointmentStatus.CANCELLED,
          actorId: requestingUserId,
          reason,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'APPOINTMENT_CANCELLED_BY_STAFF',
      entityType: 'Appointment',
      entityId: appointmentId,
      organizationId: appointment.organizationId,
      metadata: { reason },
      ipAddress,
    });

    this.eventEmitter.emit(APPOINTMENT_CANCELLED_EVENT, {
      appointmentId,
      donorId: appointment.donorId,
      organizationId: appointment.organizationId,
      scheduledStart: appointment.scheduledStart,
      cancelledByStaff: true,
      reason,
    });

    return { data: { id: result.id, status: result.status } };
  }

  /**
   * Give a seat back to its slot.
   *
   * A slot that filled up was flipped to FULL, and nothing flipped it back --
   * so the first cancellation on a full slot decremented the count and left the
   * status saying FULL, and the freed seat was invisible to every donor
   * browsing availability.
   */
  private async releaseSeat(tx: Prisma.TransactionClient, slotId: string) {
    const slot = await tx.appointmentSlot.update({
      where: { id: slotId },
      data: { bookedCount: { decrement: 1 } },
      select: { id: true, status: true, bookedCount: true, capacity: true },
    });

    if (slot.status === SlotStatus.FULL && slot.bookedCount < slot.capacity) {
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.AVAILABLE },
      });
    }
  }

  async getNextAppointment(donorId: string) {
    const appointment = await this.db.appointment.findFirst({
      where: {
        donorId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        scheduledStart: { gte: new Date() },
      },
      orderBy: { scheduledStart: 'asc' },
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

    if (!appointment) {
      return { data: null };
    }

    return {
      data: {
        id: appointment.id,
        referenceNumber: appointment.referenceNumber,
        appointmentType: appointment.appointmentType,
        status: appointment.status,
        scheduledStart: appointment.scheduledStart,
        scheduledEnd: appointment.scheduledEnd,
        organization: appointment.organization,
      },
    };
  }
}