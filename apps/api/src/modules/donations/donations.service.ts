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
  BloodGroupProvenance,
  BloodType,
  CancellationReason,
  DeferralKind,
  DeferralSource,
  DonationEventType,
  DonationStatus,
  DonationType,
  Prisma,
  RhFactor,
  RoleCode,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { withUniqueRetry } from '../../common/utils/unique-retry.util';
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
import { DonorDeferralsService } from '../donor-deferrals/donor-deferrals.service';

@Injectable()
export class DonationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly donationEligibility: DonationEligibilityService,
    private readonly donorDeferrals: DonorDeferralsService,
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

    // Re-checked here, not inherited from the booking.
    //
    // Eligibility is a function of time and of donations recorded since, so an
    // appointment that was valid when booked is not evidence of eligibility
    // now: the donor may have donated elsewhere in between, or staff may have
    // extended their window on a previous donation. Asked about now, because
    // this is the moment the donation would happen.
    await this.donationEligibility.assertEligibleToDonateAt(appointment.donorId, new Date());
    // Re-checked here for the same reason the recovery window is: a donor who
    // was clear when they booked may have been deferred since, at this centre
    // or another one. Asked about now, because this is the moment the donation
    // would happen.
    await this.donorDeferrals.assertNotDeferredAt(appointment.donorId, new Date());

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
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
        }),
      { uniqueFields: ['donationReference'] },
    );

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

      const assessment = await tx.donationAssessment.create({
        data: {
          donationId,
          decision: dto.decision,
          reasonCategory: dto.reasonCategory,
          notes: dto.notes,
          assessedBy: staffId,
        },
      });

      // Deferring a donor at the chair now defers the donor.
      //
      // `AssessmentDecision.DEFERRED` used to be a word written on one
      // donation: it stopped that donation and reached nothing else, so the
      // donor could book again the next morning and emergency matching, which
      // reads the profile flag, still considered them available (DEF-05). It
      // now raises a real deferral, in the same transaction as the assessment
      // that justified it -- a deferral without its assessment, or an
      // assessment marked DEFERRED that deferred nobody, are both worse than
      // this call failing.
      //
      // INDEFINITE, because nothing here knows how long any deferral should
      // last. No deferral schedule exists to read a period from, and inventing
      // one -- three months, six, a year -- would be exactly the clinical rule
      // this sprint may not write. Staff lift it, or replace it with a dated
      // one, from the donor record.
      if (dto.decision === AssessmentDecision.DEFERRED) {
        await tx.donation.update({
          where: { id: donationId },
          data: {
            status: DonationStatus.REJECTED,
            rejectedAt: new Date(),
            rejectedReason: dto.reasonCategory,
            staffNotes: dto.notes,
            cancellationReason: CancellationReason.DEFERRED,
          },
        });

        if (donation.appointmentId) {
          await tx.appointment.update({
            where: { id: donation.appointmentId },
            data: { status: AppointmentStatus.CANCELLED },
          });
        }

        await this.donorDeferrals.createInTransaction(tx, {
          donorId: donation.donorId,
          organizationId,
          kind: DeferralKind.INDEFINITE,
          reasonCode: dto.reasonCategory ?? null,
          reasonText: dto.notes ?? null,
          source: DeferralSource.DONATION_ASSESSMENT,
          sourceDonationId: donationId,
          createdBy: staffId,
        });
      }

      await tx.donationEvent.create({
        data: {
          donationId,
          eventType: DonationEventType.ASSESSMENT_RECORDED,
          actorId: staffId,
          organizationId,
          metadata: {
            decision: dto.decision,
            reasonCategory: dto.reasonCategory,
            assessmentId: assessment.id,
            deferralRaised: dto.decision === AssessmentDecision.DEFERRED,
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
        deferralRaised: dto.decision === AssessmentDecision.DEFERRED,
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

  /**
   * The blood group this donation is recorded and stocked under.
   *
   * Two sources, in this order, and no third:
   *
   * 1. What the collecting staff entered on this completion.
   * 2. The donor's profile group, **only** when it carries the domain's own
   *    VERIFIED status -- which means authorized staff confirmed it through
   *    `POST /donors/:id/verify-blood-type` and the row records who, when and
   *    from what source.
   *
   * An unverified self-reported group is not a third source. It is what a donor
   * typed into their profile, and labelling a bag of blood with it would turn a
   * claim into a medical fact. When neither source answers, the completion is
   * refused: staff record the group, or have it verified first.
   */
  private resolveCollectedType(
    dto: CompleteDonationDto,
    profile: { bloodType: BloodType | null; rhFactor: RhFactor | null; verificationStatus: VerificationStatus } | null,
  ): { bloodType: BloodType; rhFactor: RhFactor; source: 'STAFF_ENTERED' | 'VERIFIED_PROFILE' } {
    if (dto.bloodType && dto.rhFactor) {
      return {
        bloodType: dto.bloodType as BloodType,
        rhFactor: dto.rhFactor as RhFactor,
        source: 'STAFF_ENTERED',
      };
    }

    if (dto.bloodType || dto.rhFactor) {
      throw new BadRequestException(
        'Record both the blood group and the Rh factor, or neither. Half of a blood group is not one.',
      );
    }

    if (
      profile?.verificationStatus === VerificationStatus.VERIFIED &&
      profile.bloodType &&
      profile.rhFactor
    ) {
      return {
        bloodType: profile.bloodType,
        rhFactor: profile.rhFactor,
        source: 'VERIFIED_PROFILE',
      };
    }

    throw new BadRequestException(
      'This donation has no blood group to record. Enter the group and Rh factor collected, ' +
        "or have this donor's blood group verified first — a completed donation always " +
        'produces a unit, and a unit always carries a group.',
    );
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
      include: { appointment: true, donor: { include: { donorProfile: true } } },
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

    // Resolved before the transaction opens, so a donation that cannot produce
    // a unit is refused rather than half-completed. See `resolveCollectedType`.
    const collected = this.resolveCollectedType(dto, donation.donor.donorProfile);

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

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
          const updated = await tx.donation.update({
            where: { id: donationId },
            data: {
              status: DonationStatus.COMPLETED,
              volumeMl: dto.volumeMl,
              collectionCompletedAt: completedAt,
              bloodType: collected.bloodType,
              rhFactor: collected.rhFactor,
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
                bloodType: collected.bloodType,
                rhFactor: collected.rhFactor,
                bloodTypeSource: collected.source,
              },
            },
          });

          // Unconditional, and in the same transaction as the completion.
          //
          // This used to be `if (bloodTypeEnum && rhFactorEnum)`: omit either
          // field and the donation completed, the donor was credited with the
          // volume and the XP, and nothing entered inventory -- no error, no
          // alert, a bag of blood that exists in a fridge and not in the
          // system. `resolveCollectedType` above is what makes reaching this
          // line without a blood type impossible.
          await tx.bloodUnit.create({
            data: {
              unitReference: this.generateUnitReference(),
              donationId,
              organizationId,
              bloodType: collected.bloodType,
              rhFactor: collected.rhFactor,
              volumeMl: dto.volumeMl,
              status: 'COLLECTED',
              collectedAt: completedAt,
              // Where the group on this bag came from, recorded rather than
              // implied. Neither source is a typing of the unit: one is the
              // donor's verified profile, the other is what the collecting
              // staff wrote down. Presenting either as though the bag had been
              // grouped in a laboratory is precisely the confusion CL-05 names,
              // and this column is what prevents it.
              bloodGroupSource:
                collected.source === 'STAFF_ENTERED'
                  ? BloodGroupProvenance.STAFF_RECORDED_AT_COLLECTION
                  : BloodGroupProvenance.DONOR_PROFILE_COPY,
              bloodGroupSourceNote:
                collected.source === 'VERIFIED_PROFILE'
                  ? `Donor profile, verification source ${donation.donor.donorProfile?.bloodTypeSource ?? 'UNRECORDED'}`
                  : 'Entered by collecting staff at completion',
              // No expiry, and the column says why: no component shelf life is
              // encoded anywhere in this repository (CL-04). The release gate
              // refuses a unit whose shelf life is unknown rather than guessing
              // one here.
              expirySource: 'UNKNOWN',
            },
          });

          await tx.donationEvent.create({
            data: {
              donationId,
              eventType: DonationEventType.VERIFIED,
              actorId: staffId,
              organizationId,
              metadata: {
                bloodType: collected.bloodType,
                rhFactor: collected.rhFactor,
                volumeMl: dto.volumeMl,
                bloodTypeSource: collected.source,
              },
            },
          });

          return updated;
        }),
      { uniqueFields: ['unitReference'] },
    );

    await this.audit.log({
      actorId: staffId,
      action: 'DONATION_COMPLETED',
      entityType: 'Donation',
      entityId: donationId,
      organizationId,
      metadata: {
        donationReference: result.donationReference,
        volumeMl: dto.volumeMl,
        // The group that was actually recorded, with where it came from -- not
        // the request fields, which are empty when the profile was the source.
        bloodType: collected.bloodType,
        rhFactor: collected.rhFactor,
        bloodTypeSource: collected.source,
      },
      ipAddress,
    });

    /*
     * Whether this donation was collected for an emergency is a property of
     * this donation, not of the donor's history.
     *
     * It used to be answered by looking for any completed emergency response by
     * the same donor with a matching blood group -- no time bound, no link to
     * this donation -- so after a donor's first SOS response every routine
     * donation they ever made was scored as an emergency one and paid emergency
     * XP for it, permanently. The link is now a column the emergency path
     * writes when it creates the donation; a donation booked through an
     * appointment never carries one, which is exactly the right answer.
     */
    const isEmergency = result.emergencyResponseId !== null;

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

    // The shared eligibility service, not a local re-derivation. The local one
    // took the *earliest* nextDonationDate across every completed donation, so
    // the first donation's long-past date won forever, and it skipped donations
    // that carry no explicit date at all -- which is every emergency donation.
    // The donor's home screen therefore kept showing an eligibility date from
    // months ago right after giving blood.
    const nextDonationDate = await this.donationEligibility.getNextEligibleDonationDate(donorId);

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
          // Whether the donor has been assessed is the difference between
          // "waiting to be seen" and "cleared to donate", and the staff console
          // has no other way to tell: an approved assessment leaves the
          // donation on CHECKED_IN, so status alone cannot say.
          assessment: {
            select: {
              id: true,
              decision: true,
              assessedAt: true,
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
        collectionStartedAt: d.collectionStartedAt,
        collectionCompletedAt: d.collectionCompletedAt,
        completedAt: d.completedAt,
        createdAt: d.createdAt,
        donor: d.donor,
        appointment: d.appointment,
        assessment: d.assessment,
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            dateOfBirth: true,
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            donorProfile: {
              select: {
                bloodType: true,
                rhFactor: true,
                verificationStatus: true,
              },
            },
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