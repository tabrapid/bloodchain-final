import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeferralKind,
  DeferralSource,
  DonorReviewResolution,
  DonorReviewTriggerStatus,
  DonorStatus,
  Prisma,
  RoleCode,
  SafetyDisposition,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorDeferralsService } from '../donor-deferrals/donor-deferrals.service';

/**
 * Roles entitled to resolve a medical review.
 *
 * SUPER_ADMIN is absent, deliberately and for the third time in this codebase.
 * A platform administrator can reach the route; reaching a route is not
 * clinical authority. Resolving a review is a clinical decision about a person.
 */
export const DONOR_REVIEW_ROLES: RoleCode[] = [
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
];

/**
 * What a donor's own client is told. Never why.
 *
 * A catalogue key, not a message identifier of this module's own invention:
 * `medical.eligibility.medicalReviewRequired` exists in uz, ru and en and is on
 * the clinician's review list in `docs/clinical-review.md`. The English
 * sentence below it is the fallback for a client that cannot resolve the key,
 * not the wording a donor is meant to read.
 */
export const DONOR_REVIEW_DONOR_MESSAGE_KEY = 'medical.eligibility.medicalReviewRequired';

export interface OpenReviewSummary {
  id: string;
  organizationId: string;
  sourceKind: string;
  raisedAt: Date;
  /**
   * Deliberately absent from anything a donor sees: `triggerDisposition`,
   * `screeningResultId`, and every clinical field. This summary drives gates
   * and staff screens.
   */
  triggerDisposition: SafetyDisposition;
}

/**
 * Medical review, as a safety hold on a donor that is not a clinical judgement
 * about them.
 *
 * `DonorStatus.MEDICAL_REVIEW_REQUIRED` exists because a screening result that
 * a policy maps to BLOCK or REVIEW_REQUIRED is a reason for a clinician to
 * look, and nothing more. The Product Owner set the semantics and they are
 * enforced here rather than described:
 *
 * - It is NOT a deferral. Nothing in this service creates a `DonorDeferral`,
 *   and the one method that can create one takes an explicit clinician
 *   decision to do it.
 * - It is NOT a diagnosis, and no diagnostic wording reaches the donor. What
 *   their client is told is that a medical review is required before their next
 *   donation, and who to talk to.
 * - It is NOT permanent, and it never becomes `DEFERRED` on its own. Only a
 *   clinician resolving the review can change what happens next.
 * - Several reviews can stand at once, and resolving one does not return the
 *   donor to ACTIVE while another is open. That rule is the most dangerous one
 *   to get wrong, because getting it wrong is silent.
 *
 * `DonorProfile.donorStatus` is maintained as a cache here exactly as the
 * deferral module maintains it: the gates read the trigger ROWS, and the column
 * exists so existing screens and filters keep working.
 */
@Injectable()
export class DonorReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly deferrals: DonorDeferralsService,
  ) {}

  /**
   * Open a review inside the caller's transaction.
   *
   * Takes the transaction client rather than opening its own so that a review
   * raised from a screening result commits with the result or not at all. A
   * result recorded with no review, or a review pointing at a result that was
   * rolled back, are both worse than the operation failing.
   *
   * The profile status is claimed conditionally on being ACTIVE. A donor who is
   * already DEFERRED stays DEFERRED: overwriting a deferral with a review would
   * downgrade a clinical decision somebody made to a request that somebody look.
   */
  async openInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      donorId: string;
      organizationId: string;
      sourceKind: string;
      screeningOrderId?: string | null;
      screeningResultId?: string | null;
      triggerDisposition: SafetyDisposition;
      raisedBy: string | null;
      systemRaised: boolean;
    },
  ): Promise<{ id: string }> {
    if (input.triggerDisposition === SafetyDisposition.CLEAR) {
      // Not a guard against a caller mistake so much as a statement of what the
      // model means. A CLEAR result is not a reason for anybody to look.
      throw new BadRequestException('A clear result is not a reason for medical review.');
    }

    const trigger = await tx.donorReviewTrigger.create({
      data: {
        donorId: input.donorId,
        organizationId: input.organizationId,
        status: DonorReviewTriggerStatus.OPEN,
        sourceKind: input.sourceKind,
        screeningOrderId: input.screeningOrderId ?? null,
        screeningResultId: input.screeningResultId ?? null,
        triggerDisposition: input.triggerDisposition,
        raisedBy: input.raisedBy,
        systemRaised: input.systemRaised,
      },
      select: { id: true },
    });

    await tx.donorProfile.updateMany({
      where: { userId: input.donorId, donorStatus: DonorStatus.ACTIVE },
      data: { donorStatus: DonorStatus.MEDICAL_REVIEW_REQUIRED },
    });

    return trigger;
  }

  /** The predicate every gate asks. True while any review is open. */
  async isUnderReview(donorId: string): Promise<boolean> {
    const count = await this.db.donorReviewTrigger.count({
      where: { donorId, status: DonorReviewTriggerStatus.OPEN },
    });
    return count > 0;
  }

  /** The same answer for many donors in one query, for emergency matching. */
  async findDonorsUnderReview(donorIds: string[]): Promise<Set<string>> {
    if (donorIds.length === 0) return new Set();

    const rows = await this.db.donorReviewTrigger.findMany({
      where: { donorId: { in: donorIds }, status: DonorReviewTriggerStatus.OPEN },
      select: { donorId: true },
      distinct: ['donorId'],
    });

    return new Set(rows.map((row) => row.donorId));
  }

  /** Open reviews for one donor, newest first. Staff view. */
  async getOpenReviews(donorId: string): Promise<OpenReviewSummary[]> {
    const triggers = await this.db.donorReviewTrigger.findMany({
      where: { donorId, status: DonorReviewTriggerStatus.OPEN },
      orderBy: { raisedAt: 'desc' },
      select: {
        id: true,
        organizationId: true,
        sourceKind: true,
        raisedAt: true,
        triggerDisposition: true,
      },
    });
    return triggers;
  }

  /**
   * Resolve one review.
   *
   * The whole method is written around one rule: resolving a review is a
   * clinician's decision about THIS review, and nothing about it may be
   * inferred onto the donor's overall state. So the status change is computed
   * after the resolution is written, from what is still standing, and the only
   * way a deferral gets created is a clinician asking for one by choosing a
   * deferral resolution.
   */
  async resolve(
    organizationId: string,
    triggerId: string,
    actorId: string,
    input: {
      resolution: DonorReviewResolution;
      note?: string | null;
      /** Required when the resolution defers; the deferral's structured code. */
      deferralReasonCode?: string | null;
      /** Required for a temporary deferral. */
      deferralEndsAt?: string | null;
      /** The clinician's verbatim note, which stays with the raising organization. */
      confidentialNote?: string | null;
    },
    ipAddress?: string,
  ) {
    await this.assertClinicalReviewer(actorId, organizationId);

    const trigger = await this.db.donorReviewTrigger.findUnique({
      where: { id: triggerId },
      select: { id: true, donorId: true, organizationId: true, status: true },
    });

    if (!trigger) {
      throw new NotFoundException('Medical review not found.');
    }

    // The same boundary Sprint 9 drew around lifting a deferral: the decision
    // belongs to the organization whose clinician is responsible for it.
    if (trigger.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This medical review was raised by another organization. Only that organization can resolve it.',
      );
    }

    if (trigger.status === DonorReviewTriggerStatus.RESOLVED) {
      throw new ConflictException('This medical review has already been resolved.');
    }

    const defers =
      input.resolution === DonorReviewResolution.TEMPORARY_DEFERRAL ||
      input.resolution === DonorReviewResolution.INDEFINITE_DEFERRAL;

    if (defers && !input.deferralReasonCode) {
      throw new BadRequestException(
        'A deferral needs a structured reason code. Resolving a review does not invent one.',
      );
    }
    if (input.resolution === DonorReviewResolution.TEMPORARY_DEFERRAL && !input.deferralEndsAt) {
      throw new BadRequestException('A temporary deferral needs an end date.');
    }

    const now = new Date();

    const outcome = await this.db.$transaction(async (tx) => {
      // Claimed, not assumed. Two clinicians resolving the same review at once
      // must not both write a deferral.
      const claimed = await tx.donorReviewTrigger.updateMany({
        where: { id: triggerId, status: DonorReviewTriggerStatus.OPEN },
        data: {
          status: DonorReviewTriggerStatus.RESOLVED,
          resolvedAt: now,
          resolvedBy: actorId,
          resolution: input.resolution,
          resolutionNote: input.note ?? null,
        },
      });

      if (claimed.count === 0) {
        throw new ConflictException('This medical review has already been resolved.');
      }

      let deferralId: string | null = null;

      if (defers) {
        // The ONLY path from a screening result to a deferral, and it runs
        // because a clinician chose it -- never because a disposition said so.
        const deferral = await this.deferrals.createInTransaction(tx, {
          donorId: trigger.donorId,
          organizationId,
          kind:
            input.resolution === DonorReviewResolution.TEMPORARY_DEFERRAL
              ? DeferralKind.TEMPORARY
              : DeferralKind.INDEFINITE,
          reasonCode: input.deferralReasonCode ?? null,
          confidentialNote: input.confidentialNote ?? null,
          endsAt:
            input.resolution === DonorReviewResolution.TEMPORARY_DEFERRAL
              ? new Date(input.deferralEndsAt as string)
              : null,
          source: DeferralSource.STAFF_DECISION,
          createdBy: actorId,
        });
        deferralId = deferral.id;
      }

      // What the donor's status becomes, computed from what is STILL standing
      // rather than from this resolution.
      //
      // Returning to ACTIVE takes two things to be true at once: no other
      // review is open, and no deferral is in force. Checking only the first
      // would let resolving a review clear a deferral raised for an entirely
      // different reason; checking only the second would let one of two open
      // reviews clear the other. Both failures are silent, which is why both
      // are checked here and tested separately.
      const otherOpenReviews = await tx.donorReviewTrigger.count({
        where: {
          donorId: trigger.donorId,
          status: DonorReviewTriggerStatus.OPEN,
          id: { not: triggerId },
        },
      });

      const deferralsInForce = await tx.donorDeferral.count({
        where: {
          donorId: trigger.donorId,
          liftedAt: null,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      });

      let resultingStatus: DonorStatus | null = null;

      if (deferralsInForce > 0) {
        // `createInTransaction` has already written DEFERRED; this records what
        // the donor's state actually is for the audit trail.
        resultingStatus = DonorStatus.DEFERRED;
      } else if (otherOpenReviews > 0) {
        resultingStatus = DonorStatus.MEDICAL_REVIEW_REQUIRED;
      } else if (input.resolution === DonorReviewResolution.REMAINS_UNDER_REVIEW) {
        // Looked at, not concluded. The trigger is closed as handled but the
        // donor is not returned to donating, so a fresh one is opened to carry
        // the state forward rather than leaving the hold resting on nothing.
        await tx.donorReviewTrigger.create({
          data: {
            donorId: trigger.donorId,
            organizationId,
            status: DonorReviewTriggerStatus.OPEN,
            sourceKind: 'CLINICIAN_CONTINUED_REVIEW',
            triggerDisposition: SafetyDisposition.REVIEW_REQUIRED,
            raisedBy: actorId,
            systemRaised: false,
          },
        });
        resultingStatus = DonorStatus.MEDICAL_REVIEW_REQUIRED;
      } else {
        await tx.donorProfile.updateMany({
          where: {
            userId: trigger.donorId,
            donorStatus: DonorStatus.MEDICAL_REVIEW_REQUIRED,
          },
          data: { donorStatus: DonorStatus.ACTIVE },
        });
        resultingStatus = DonorStatus.ACTIVE;
      }

      await tx.donorReviewTrigger.update({
        where: { id: triggerId },
        data: { resultingDeferralId: deferralId, resultingDonorStatus: resultingStatus },
      });

      return { deferralId, resultingStatus };
    });

    await this.audit.log({
      actorId,
      action: 'DONOR_MEDICAL_REVIEW_RESOLVED',
      entityType: 'DonorReviewTrigger',
      entityId: triggerId,
      organizationId,
      // The decision, the actor and the consequence. Never the clinician's
      // note: it is verbatim clinical text and belongs in the deferral row
      // that Sprint 9 made organization-confidential, not in an audit entry.
      metadata: {
        donorId: trigger.donorId,
        resolution: input.resolution,
        resultingDonorStatus: outcome.resultingStatus,
        createdDeferral: outcome.deferralId !== null,
      },
      ipAddress,
    });

    return {
      data: {
        id: triggerId,
        status: DonorReviewTriggerStatus.RESOLVED,
        resolution: input.resolution,
        resultingDonorStatus: outcome.resultingStatus,
        deferralId: outcome.deferralId,
      },
    };
  }

  /** The staff worklist: reviews awaiting a clinician at this organization. */
  async listForOrganization(
    organizationId: string,
    actorId: string,
    filters: { status?: DonorReviewTriggerStatus; take?: number },
  ) {
    await this.assertClinicalReviewer(actorId, organizationId);

    const triggers = await this.db.donorReviewTrigger.findMany({
      where: {
        organizationId,
        status: filters.status ?? DonorReviewTriggerStatus.OPEN,
      },
      orderBy: { raisedAt: 'desc' },
      take: Math.min(filters.take ?? 50, 200),
      include: {
        donor: { select: { id: true, firstName: true, lastName: true } },
        screeningOrder: { select: { id: true, orderReference: true } },
      },
    });

    return {
      data: triggers.map((trigger) => ({
        id: trigger.id,
        donorId: trigger.donorId,
        donorName: `${trigger.donor.firstName} ${trigger.donor.lastName}`,
        status: trigger.status,
        sourceKind: trigger.sourceKind,
        triggerDisposition: trigger.triggerDisposition,
        screeningOrderId: trigger.screeningOrderId,
        screeningOrderReference: trigger.screeningOrder?.orderReference ?? null,
        raisedAt: trigger.raisedAt,
        systemRaised: trigger.systemRaised,
        resolvedAt: trigger.resolvedAt,
        resolution: trigger.resolution,
      })),
    };
  }

  /**
   * What the donor's own client is told.
   *
   * A boolean, a translation key and a phone number's worth of "talk to staff".
   * No disposition, no source kind, no screening reference, no organization
   * name, no count of how many reviews stand. Every one of those is a hint
   * about a clinical finding, and the Product Owner's instruction is explicit:
   * do not expose diagnostic wording to the donor.
   */
  async getDonorFacingStatus(donorId: string) {
    const underReview = await this.isUnderReview(donorId);

    return {
      medicalReviewRequired: underReview,
      messageKey: underReview ? DONOR_REVIEW_DONOR_MESSAGE_KEY : null,
      message: underReview
        ? 'Medical review is required before your next donation. Staff at the blood centre can help.'
        : null,
    };
  }

  private async assertClinicalReviewer(actorId: string, organizationId: string): Promise<void> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, organizationId, status: 'ACTIVE' },
      include: { role: true },
    });

    const permitted = memberships.some((membership) =>
      DONOR_REVIEW_ROLES.includes(membership.role.code),
    );

    if (!permitted) {
      throw new ForbiddenException(
        'Resolving a medical review is a clinical decision. This account holds no clinical role at this organization.',
      );
    }
  }
}
