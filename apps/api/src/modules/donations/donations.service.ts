import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppointmentStatus,
  AssessmentDecision,
  BloodType,
  DonationEventType,
  DonationStatus,
  DonationType,
  Prisma,
  RhFactor,
  RoleCode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CheckInDonationDto,
  RecordAssessmentDto,
  StartDonationDto,
  CompleteDonationDto,
  CancelDonationDto,
  AbortDonationDto,
  GetMyDonationsDto,
  GetOrganizationDonationsDto,
} from './dto/donation.dto';
import { DONATION_COMPLETED_EVENT, DonationCompletedPayload } from '../gamification/events/gamification-event.handler';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';

@Injectable()
export class DonationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly donationEligibility: DonationEligibilityService,
  ) {}

  private generateDonationReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `DONATION-${year}-${random}`;
  }

  private generateUnitReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `BU-${year}-${random}`;
  }

  async checkInDonation(
    appointmentId: string,
    organizationId: string,
    staffId: string,
    dto: CheckInDonationDto,
    ipAddress?: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        donor: {
          include: {
            donorProfile: {
              select: {
                bloodType: true,
                rhFactor: true,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.organizationId !== organizationId) {
      throw new ForbiddenException('This appointment does not belong to your organization.');
    }

    if (appointment.appointmentType !== 'BLOOD_DONATION') {
      throw new BadRequestException('This endpoint is only for blood donation appointments.');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('This appointment has been cancelled.');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('This appointment has already been completed.');
    }

    const existingDonation = await this.db.donation.findUnique({
      where: { appointmentId },
    });

    if (existingDonation) {
      throw new ConflictException('A donation record already exists for this appointment.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          donationReference: this.generateDonationReference(),
          donorId: appointment.donor.id,
          organizationId,
          appointmentId,
          donationType: DonationType.WHOLE_BLOOD,
          status: DonationStatus.CHECKED_IN,
          bloodType: appointment.donor.donorProfile?.bloodType ?? undefined,
          rhFactor: appointment.donor.donorProfile?.rhFactor ?? undefined,
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

      await tx.donationEvent.create({
        data: {
          donationId: donation.id,
          eventType: DonationEventType.CREATED,
          actorId: staffId,
          organizationId,
          metadata: { appointmentId },
        },
      });

      await tx.donationEvent.create({
        data: {
          donationId: donation.id,
          eventType: DonationEventType.CHECKED_IN,
          actorId: staffId,
          organizationId,
        },
      });

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CONFIRMED },
      });

      return donation;
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_CHECKED_IN',
      entityType: 'Donation',
      entityId: result.id,
      organizationId,
      metadata: {
        donationReference: result.donationReference,
        appointmentId,
        donorId: appointment.donorId,
      },
      ipAddress,
    });

    return {
      data: {
        id: result.id,
        donationReference: result.donationReference,
        status: result.status,
        donationType: result.donationType,
        bloodType: result.bloodType,
        rhFactor: result.rhFactor,
        organization: result.organization,
        donor: {
          id: appointment.donor.id,
          firstName: appointment.donor.firstName,
          lastName: appointment.donor.lastName,
        },
      },
    };
  }

  async recordAssessment(
    donationId: string,
    organizationId: string,
    staffId: string,
    dto: RecordAssessmentDto,
    ipAddress?: string,
  ) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    if (donation.status !== DonationStatus.CHECKED_IN) {
      throw new BadRequestException('Assessment can only be recorded for checked-in donations.');
    }

    const result = await this.db.$transaction(async (tx) => {
      if (dto.decision === AssessmentDecision.NOT_COMPLETED) {
        await tx.donation.update({
          where: { id: donationId },
          data: {
            status: DonationStatus.REJECTED,
            rejectedAt: new Date(),
            rejectedReason: dto.reasonCategory,
            staffNotes: dto.notes,
          },
        });

        await tx.appointment.update({
          where: { id: donation.appointmentId! },
          data: { status: AppointmentStatus.NO_SHOW },
        });
      }

      await tx.donationAssessment.create({
        data: {
          donationId,
          decision: dto.decision,
          reasonCategory: dto.reasonCategory,
          notes: dto.notes,
          assessedBy: staffId,
        },
      });

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.ASSESSMENT_RECORDED,
          actorId: staffId,
          organizationId,
          metadata: {
            decision: dto.decision,
            reasonCategory: dto.reasonCategory,
          },
        },
      });

      return tx.donation.findUnique({
        where: { id: donationId },
        include: {
          assessment: true,
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_ASSESSMENT_RECORDED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      metadata: {
        decision: dto.decision,
        reasonCategory: dto.reasonCategory,
      },
      ipAddress,
    });

    return { data: result };
  }

  async startDonation(
    donationId: string,
    organizationId: string,
    staffId: string,
    dto: StartDonationDto,
    ipAddress?: string,
  ) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      include: { assessment: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    if (donation.status !== DonationStatus.CHECKED_IN) {
      throw new BadRequestException('Only checked-in donations can be started.');
    }

    if (donation.assessment && donation.assessment.decision !== AssessmentDecision.APPROVED_FOR_DONATION) {
      throw new BadRequestException('Donation cannot proceed without approved assessment.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: DonationStatus.IN_PROGRESS,
          donationType: dto.donationType ?? DonationType.WHOLE_BLOOD,
          collectionStartedAt: new Date(),
        },
      });

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.STARTED,
          actorId: staffId,
          organizationId,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_STARTED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      ipAddress,
    });

    return {
      data: {
        id: result.id,
        donationReference: result.donationReference,
        status: result.status,
        donationType: result.donationType,
        collectionStartedAt: result.collectionStartedAt,
      },
    };
  }

  async completeDonation(
    donationId: string,
    organizationId: string,
    staffId: string,
    dto: CompleteDonationDto,
    ipAddress?: string,
  ) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      include: { appointment: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    if (donation.status !== DonationStatus.IN_PROGRESS) {
      throw new BadRequestException('Only in-progress donations can be completed.');
    }

    const completedAt = new Date(dto.collectionCompletedAt);
    if (completedAt > new Date()) {
      throw new BadRequestException('Collection completion time cannot be in the future.');
    }

    const now = new Date();
    // The donor eligibility window is measured from when this donation is
    // marked complete, not from the free-text collection timestamp - that's
    // also what DonationEligibilityService reads back later, so the two
    // must agree on which timestamp is authoritative.
    const nextDonationDate = dto.nextDonationDate
      ? new Date(dto.nextDonationDate)
      : this.donationEligibility.computeDefaultNextEligibleDate(now);

    const result = await this.db.$transaction(async (tx) => {
      const bloodTypeEnum = dto.bloodType as BloodType | undefined;
      const rhFactorEnum = dto.rhFactor as RhFactor | undefined;

      const updated = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: DonationStatus.COMPLETED,
          volumeMl: dto.volumeMl,
          collectionCompletedAt: completedAt,
          bloodType: bloodTypeEnum,
          rhFactor: rhFactorEnum,
          staffNotes: dto.notes,
          nextDonationDate,
          completedAt: now,
          completedBy: staffId,
        },
      });

      if (donation.appointmentId) {
        await tx.appointment.update({
          where: { id: donation.appointmentId },
          data: { status: AppointmentStatus.COMPLETED },
        });
      }

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.COMPLETED,
          actorId: staffId,
          organizationId,
          metadata: {
            volumeMl: dto.volumeMl,
            bloodType: dto.bloodType,
            rhFactor: dto.rhFactor,
          },
        },
      });

      if (bloodTypeEnum && rhFactorEnum) {
        await tx.bloodUnit.create({
          data: {
            unitReference: this.generateUnitReference(),
            donationId,
            organizationId,
            bloodType: bloodTypeEnum,
            rhFactor: rhFactorEnum,
            volumeMl: dto.volumeMl,
            status: 'COLLECTED',
            collectedAt: completedAt,
          },
        });

        await tx.donationEvent.create({
          data: {
            donationId,
            eventType: DonationEventType.VERIFIED,
            actorId: staffId,
            organizationId,
            metadata: {
              bloodType: bloodTypeEnum,
              rhFactor: rhFactorEnum,
              volumeMl: dto.volumeMl,
            },
          },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_COMPLETED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      metadata: {
        donationReference: result.donationReference,
        volumeMl: dto.volumeMl,
        bloodType: dto.bloodType,
        rhFactor: dto.rhFactor,
      },
      ipAddress,
    });

    const isEmergency = await this.db.emergencyResponse.findFirst({
      where: {
        donorId: donation.donorId,
        status: 'COMPLETED',
        emergencyRequest: {
          bloodType: dto.bloodType as BloodType,
          rhFactor: dto.rhFactor as RhFactor,
        },
      },
    }).then(r => !!r);

    this.eventEmitter.emit(DONATION_COMPLETED_EVENT, {
      donationId: result.id,
      donorId: donation.donorId,
      organizationId,
      isEmergency,
    } as DonationCompletedPayload);

    return {
      data: {
        id: result.id,
        donationReference: result.donationReference,
        status: result.status,
        volumeMl: result.volumeMl,
        bloodType: result.bloodType,
        rhFactor: result.rhFactor,
        collectionStartedAt: result.collectionStartedAt,
        collectionCompletedAt: result.collectionCompletedAt,
        completedAt: result.completedAt,
        nextDonationDate: result.nextDonationDate,
      },
    };
  }

  async cancelDonation(
    donationId: string,
    organizationId: string,
    staffId: string,
    dto: CancelDonationDto,
    ipAddress?: string,
  ) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    const cancellableStatuses: DonationStatus[] = [DonationStatus.SCHEDULED, DonationStatus.CHECKED_IN];
    if (!cancellableStatuses.includes(donation.status as DonationStatus)) {
      throw new BadRequestException('This donation cannot be cancelled.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: DonationStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledAt: new Date(),
        },
      });

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.CANCELLED,
          actorId: staffId,
          organizationId,
          metadata: { reason: dto.reason, notes: dto.notes },
        },
      });

      if (donation.appointmentId) {
        await tx.appointment.update({
          where: { id: donation.appointmentId },
          data: { status: AppointmentStatus.CANCELLED },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_CANCELLED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      metadata: {
        reason: dto.reason,
        notes: dto.notes,
      },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status } };
  }

  async abortDonation(
    donationId: string,
    organizationId: string,
    staffId: string,
    dto: AbortDonationDto,
    ipAddress?: string,
  ) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    if (donation.status !== DonationStatus.IN_PROGRESS) {
      throw new BadRequestException('Only in-progress donations can be aborted.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: DonationStatus.ABORTED,
          abortedAt: new Date(),
          abortedReason: dto.reason,
          staffNotes: dto.notes,
        },
      });

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.ABORTED,
          actorId: staffId,
          organizationId,
          metadata: { reason: dto.reason, notes: dto.notes },
        },
      });

      if (donation.appointmentId) {
        await tx.appointment.update({
          where: { id: donation.appointmentId },
          data: { status: AppointmentStatus.NO_SHOW },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_ABORTED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      metadata: {
        reason: dto.reason,
        notes: dto.notes,
      },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status } };
  }

  async getMyDonations(donorId: string, filters: GetMyDonationsDto) {
    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.DonationWhereInput = { donorId };

    if (filters.status) {
      where.status = filters.status as DonationStatus;
    }

    if (filters.upcoming === 'true') {
      where.completedAt = null;
      where.cancelledAt = null;
      where.abortedAt = null;
    } else if (filters.past === 'true') {
      where.completedAt = { not: null };
    } else if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.collectionCompletedAt = { gte: startOfDay, lte: endOfDay };
    }

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    const [donations, total] = await Promise.all([
      this.db.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      }),
      this.db.donation.count({ where }),
    ]);

    return {
      data: donations.map((d) => ({
        id: d.id,
        donationReference: d.donationReference,
        donationType: d.donationType,
        status: d.status,
        bloodType: d.bloodType,
        rhFactor: d.rhFactor,
        volumeMl: d.volumeMl,
        collectionCompletedAt: d.collectionCompletedAt,
        organization: d.organization,
        nextDonationDate: d.nextDonationDate,
        createdAt: d.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDonationById(donationId: string, requestingUserId: string) {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
        appointment: {
          select: {
            id: true,
            referenceNumber: true,
            scheduledStart: true,
            scheduledEnd: true,
          },
        },
        assessment: {
          select: {
            id: true,
            decision: true,
            reasonCategory: true,
            notes: true,
            assessedAt: true,
            assessor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        bloodUnit: {
          select: {
            id: true,
            status: true,
            collectedAt: true,
          },
        },
      },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    const isDonor = donation.donorId === requestingUserId;
    const isStaff = user.memberships.some(
      (m) =>
        m.organizationId === donation.organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );
    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isDonor && !isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to view this donation.');
    }

    const response: any = {
      id: donation.id,
      donationReference: donation.donationReference,
      donationType: donation.donationType,
      status: donation.status,
      bloodType: donation.bloodType,
      rhFactor: donation.rhFactor,
      volumeMl: donation.volumeMl,
      collectionStartedAt: donation.collectionStartedAt,
      collectionCompletedAt: donation.collectionCompletedAt,
      nextDonationDate: donation.nextDonationDate,
      cancellationReason: donation.cancellationReason,
      cancelledAt: donation.cancelledAt,
      abortedReason: donation.abortedReason,
      abortedAt: donation.abortedAt,
      rejectedReason: donation.rejectedReason,
      rejectedAt: donation.rejectedAt,
      completedAt: donation.completedAt,
      createdAt: donation.createdAt,
      organization: donation.organization,
      appointment: donation.appointment,
    };

    if (isStaff || isSuperAdmin) {
      response.assessment = donation.assessment;
      response.staffNotes = donation.staffNotes;
    }

    return { data: response };
  }

  async getMyDonationStatistics(donorId: string) {
    const donations = await this.db.donation.findMany({
      where: { donorId },
    });

    const completed = donations.filter((d) => d.status === DonationStatus.COMPLETED);
    const cancelled = donations.filter((d) => d.status === DonationStatus.CANCELLED);
    const aborted = donations.filter((d) => d.status === DonationStatus.ABORTED);

    const totalVolumeMl = completed.reduce((sum, d) => sum + (d.volumeMl || 0), 0);

    const lastDonation = completed.length > 0
      ? completed.sort((a, b) => (b.collectionCompletedAt?.getTime() || 0) - (a.collectionCompletedAt?.getTime() || 0))[0]
      : null;

    const nextDonationDate = completed.length > 0
      ? completed
          .filter((d) => d.nextDonationDate)
          .sort((a, b) => (a.nextDonationDate?.getTime() || 0) - (b.nextDonationDate?.getTime() || 0))[0]?.nextDonationDate
      : null;

    return {
      data: {
        totalDonations: completed.length,
        totalVolumeMl,
        lastDonationAt: lastDonation?.collectionCompletedAt || null,
        nextDonationDate,
        completedCount: completed.length,
        cancelledCount: cancelled.length,
        abortedCount: aborted.length,
      },
    };
  }

  async getOrganizationDonations(organizationId: string, requestingUserId: string, filters: GetOrganizationDonationsDto) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    const isStaff = user.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );
    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to view these donations.');
    }

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.DonationWhereInput = { organizationId };

    if (filters.status) {
      where.status = filters.status as DonationStatus;
    }

    if (filters.donationType) {
      where.donationType = filters.donationType as DonationType;
    }

    if (filters.today === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    if (filters.search) {
      where.OR = [
        { donationReference: { contains: filters.search, mode: 'insensitive' } },
        {
          donor: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [donations, total] = await Promise.all([
      this.db.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          donor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          appointment: {
            select: {
              id: true,
              referenceNumber: true,
            },
          },
        },
      }),
      this.db.donation.count({ where }),
    ]);

    return {
      data: donations.map((d) => ({
        id: d.id,
        donationReference: d.donationReference,
        donationType: d.donationType,
        status: d.status,
        bloodType: d.bloodType,
        rhFactor: d.rhFactor,
        volumeMl: d.volumeMl,
        collectionCompletedAt: d.collectionCompletedAt,
        createdAt: d.createdAt,
        donor: d.donor,
        appointment: d.appointment,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDonationForCheckIn(appointmentId: string, organizationId: string, requestingUserId: string) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        donor: {
          include: {
            donorProfile: {
              select: {
                id: true,
                bloodType: true,
                rhFactor: true,
                verificationStatus: true,
                dateOfBirth: true,
                city: true,
                district: true,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            dateOfBirth: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
          },
        },
        slot: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.organizationId !== organizationId) {
      throw new ForbiddenException('This appointment does not belong to your organization.');
    }

    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    const isStaff = user.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );
    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to view this appointment.');
    }

    return {
      data: {
        appointment: {
          id: appointment.id,
          referenceNumber: appointment.referenceNumber,
          appointmentType: appointment.appointmentType,
          scheduledStart: appointment.scheduledStart,
          scheduledEnd: appointment.scheduledEnd,
        },
        donor: {
          id: appointment.donor.id,
          firstName: appointment.donor.firstName,
          lastName: appointment.donor.lastName,
          email: appointment.donor.email,
          bloodType: appointment.donor.donorProfile?.bloodType,
          rhFactor: appointment.donor.donorProfile?.rhFactor,
          verificationStatus: appointment.donor.donorProfile?.verificationStatus,
          dateOfBirth: appointment.donor.donorProfile?.dateOfBirth,
          city: appointment.donor.donorProfile?.city,
          district: appointment.donor.donorProfile?.district,
        },
        organization: appointment.organization,
      },
    };
  }

  async getTodayAppointments(organizationId: string, requestingUserId: string) {
    const user = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    const isStaff = user.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );
    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to view these appointments.');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.db.appointment.findMany({
      where: {
        organizationId,
        appointmentType: 'BLOOD_DONATION',
        scheduledStart: { gte: startOfDay, lte: endOfDay },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      orderBy: { scheduledStart: 'asc' },
      include: {
        donor: {
          include: {
            donorProfile: {
              select: {
                bloodType: true,
                rhFactor: true,
                verificationStatus: true,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        donation: {
          select: {
            id: true,
            status: true,
            donationReference: true,
          },
        },
      },
    });

    return {
      data: appointments.map((apt) => ({
        id: apt.id,
        referenceNumber: apt.referenceNumber,
        scheduledStart: apt.scheduledStart,
        scheduledEnd: apt.scheduledEnd,
        status: apt.status,
        donor: {
          id: apt.donor.id,
          firstName: apt.donor.firstName,
          lastName: apt.donor.lastName,
          email: apt.donor.email,
          bloodType: apt.donor.donorProfile?.bloodType,
          rhFactor: apt.donor.donorProfile?.rhFactor,
        },
        donation: apt.donation
          ? {
              id: apt.donation.id,
              status: apt.donation.status,
              donationReference: apt.donation.donationReference,
            }
          : null,
      })),
    };
  }
}