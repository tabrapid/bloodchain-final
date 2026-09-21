import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DonationSampleStatus,
  Prisma,
  SafetyDisposition,
  ScreeningOrderStatus,
  ScreeningResultSource,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorReviewService } from '../donor-review/donor-review.service';
import { RecallService, RecallTrigger } from '../recall/recall.service';
import {
  DispositionResolution,
  requiresDonorReview,
  resolveDisposition,
  satisfiesRequirement,
} from './screening-disposition';
import { ScreeningOrdersService } from './screening-orders.service';
import { SCREENING_MESSAGES, ScreeningReason, ScreeningReasonCode } from './screening.reasons';

/** What raised a medical review, recorded on the trigger so a later source cannot be mistaken for this one. */
export const SCREENING_REVIEW_SOURCE = 'BLOOD_BANK_SCREENING_RESULT';

export interface RecordResultInput {
  requirementCode: string;
  resultCode: string;
  resultValue?: string | null;
  sampleId?: string | null;
  source?: ScreeningResultSource;
  methodReference?: string | null;
  reagentReference?: string | null;
  reagentLot?: string | null;
  reagentExpiresAt?: string | null;
  analyzerReference?: string | null;
  performedAt?: string | null;
  receivedAt?: string | null;
  comment?: string | null;
  confidentialComment?: string | null;
}

/**
 * Recording, reviewing and correcting screening results.
 *
 * Three separations run through the whole file, and each of them is a fact the
 * system used to conflate:
 *
 * 1. **Entering a result is not reviewing it.** A result carries
 *    `performedBy`/`performedAt` and, separately, `reviewedBy`/`reviewedAt`.
 *    The same person cannot be both, whatever roles they hold, and a policy
 *    that requires review does not treat an unreviewed result as an answer.
 * 2. **A raw result code is not a safety decision.** The laboratory's code is
 *    stored verbatim and uninterpreted. What it MEANS comes from the approved
 *    policy's disposition rules, and where no rule describes a code the system
 *    says so rather than guessing (see `screening-disposition.ts`).
 * 3. **A result about blood is not a diagnosis about a donor.** A disposition
 *    the policy maps to BLOCK or REVIEW_REQUIRED opens a medical review, which
 *    asks a clinician to look. It does not defer the donor, does not create a
 *    deferral row, and does not record anything diagnostic about them.
 *
 * Corrections never overwrite. A correction writes a new result, supersedes the
 * old one and records a revision joining them -- and where the corrected
 * meaning is worse than the one a component was released on, it opens a recall
 * in the same transaction.
 */
@Injectable()
export class ScreeningResultsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly orders: ScreeningOrdersService,
    private readonly donorReview: DonorReviewService,
    private readonly recall: RecallService,
  ) {}

  /**
   * Record one result against one requirement of one order.
   *
   * Everything about where the result came from is captured at the moment it is
   * entered -- reagent lot and expiry, analyser, method, who performed it and
   * when the sample was received -- because a look-back years later asks
   * exactly those questions and none of them can be reconstructed afterwards.
   */
  async recordResult(
    organizationId: string,
    orderId: string,
    actorId: string,
    input: RecordResultInput,
    ipAddress?: string,
  ) {
    await this.orders.assertScreeningStaffFor(actorId, organizationId);

    const order = await this.db.screeningOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        policy: { include: { requirements: true, dispositionRules: true } },
        donation: { select: { id: true, donorId: true, donationReference: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Screening order not found.');
    }

    if (
      order.status !== ScreeningOrderStatus.OPEN &&
      order.status !== ScreeningOrderStatus.IN_PROGRESS &&
      order.status !== ScreeningOrderStatus.AWAITING_REVIEW
    ) {
      throw this.refusal(ScreeningReason.ORDER_NOT_OPEN);
    }

    // Against the PINNED requirement list. A requirement added to a later
    // policy version is not something this order asked for, and recording a
    // result against it would quietly rewrite what the order required.
    const requirement = order.policy.requirements.find(
      (candidate) => candidate.code === input.requirementCode,
    );

    if (!requirement) {
      throw this.refusal(ScreeningReason.REQUIREMENT_NOT_IN_POLICY);
    }

    const sampleId = input.sampleId ?? order.sampleId ?? null;
    if (sampleId) {
      const sample = await this.db.donationSample.findFirst({
        where: { id: sampleId, organizationId },
        select: { id: true, donationId: true, status: true },
      });

      // A rejected sample cannot satisfy anything, and neither can one drawn
      // from a different donation. Both are refusals rather than warnings.
      if (!sample || sample.donationId !== order.donationId) {
        throw this.refusal(ScreeningReason.SAMPLE_UNUSABLE);
      }
      if (sample.status === DonationSampleStatus.REJECTED) {
        throw this.refusal(ScreeningReason.SAMPLE_UNUSABLE);
      }
    }

    const resolution = resolveDisposition(
      requirement.code,
      input.resultCode,
      order.policy.dispositionRules,
      order.policyVersion,
    );

    const created = await this.db.$transaction(async (tx) => {
      const result = await tx.screeningResult.create({
        data: {
          screeningOrderId: order.id,
          requirementId: requirement.id,
          // Copied, so the row stays readable if the policy moves.
          requirementCode: requirement.code,
          sampleId,
          resultCode: input.resultCode,
          resultValue: input.resultValue ?? null,
          disposition: resolution.disposition,
          // Null when no rule described the code. The marker that the system
          // defaulted rather than being told.
          dispositionPolicyVersion: resolution.policyVersion,
          source: input.source ?? ScreeningResultSource.MANUAL,
          methodReference: input.methodReference ?? null,
          reagentReference: input.reagentReference ?? null,
          reagentLot: input.reagentLot ?? null,
          reagentExpiresAt: input.reagentExpiresAt ? new Date(input.reagentExpiresAt) : null,
          analyzerReference: input.analyzerReference ?? null,
          performedBy: actorId,
          performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
          comment: input.comment ?? null,
          confidentialComment: input.confidentialComment ?? null,
        },
      });

      let reviewTriggerId: string | null = null;

      if (requiresDonorReview(resolution)) {
        const trigger = await this.donorReview.openInTransaction(tx, {
          donorId: order.donation.donorId,
          organizationId,
          sourceKind: SCREENING_REVIEW_SOURCE,
          screeningOrderId: order.id,
          screeningResultId: result.id,
          triggerDisposition: resolution.disposition,
          raisedBy: actorId,
          // The system raised it, not the technician. Attributing a safety
          // consequence to whoever happened to type the result would make the
          // audit trail read as a clinical decision they did not make.
          systemRaised: true,
        });
        reviewTriggerId = trigger.id;
      }

      await this.advanceOrderStatus(tx, order.id);

      return { result, reviewTriggerId };
    });

    await this.audit.log({
      actorId,
      action: 'SCREENING_RESULT_RECORDED',
      entityType: 'ScreeningResult',
      entityId: created.result.id,
      organizationId,
      // The requirement, the disposition and the provenance. The raw result
      // code is recorded too -- it is a laboratory fact, not a clinical
      // narrative -- but `confidentialComment` never is.
      metadata: {
        screeningOrderId: order.id,
        donationId: order.donationId,
        requirementCode: requirement.code,
        resultCode: input.resultCode,
        disposition: resolution.disposition,
        dispositionMapped: resolution.mapped,
        dispositionPolicyVersion: resolution.policyVersion,
        source: input.source ?? ScreeningResultSource.MANUAL,
        reagentLot: input.reagentLot ?? null,
        analyzerReference: input.analyzerReference ?? null,
        medicalReviewOpened: created.reviewTriggerId !== null,
      },
      ipAddress,
    });

    return {
      data: {
        id: created.result.id,
        requirementCode: requirement.code,
        resultCode: created.result.resultCode,
        disposition: created.result.disposition,
        dispositionPolicyVersion: created.result.dispositionPolicyVersion,
        /**
         * Said out loud rather than inferred from a null. A console that shows
         * "REVIEW_REQUIRED" without this cannot tell a policy decision from the
         * system refusing to guess.
         */
        dispositionMapped: resolution.mapped,
        satisfiesRequirement: satisfiesRequirement(resolution),
        performedAt: created.result.performedAt,
        reviewedAt: created.result.reviewedAt,
        medicalReviewOpened: created.reviewTriggerId !== null,
      },
    };
  }

  /**
   * Review a result.
   *
   * The two rules here are the whole point of the method existing separately
   * from `recordResult`: the reviewer may not be the performer, and a platform
   * administrator is not a clinical reviewer. Both are enforced in the service
   * and not only in a route decorator, because a decorator is one edit away
   * from being wrong and a service is where the test can reach.
   */
  async reviewResult(
    organizationId: string,
    resultId: string,
    actorId: string,
    input: { note?: string | null },
    ipAddress?: string,
  ) {
    await this.orders.assertScreeningStaffFor(actorId, organizationId);

    const result = await this.db.screeningResult.findFirst({
      where: { id: resultId, screeningOrder: { organizationId } },
      select: {
        id: true,
        performedBy: true,
        reviewedAt: true,
        superseded: true,
        requirementCode: true,
        disposition: true,
        screeningOrderId: true,
      },
    });

    if (!result) {
      throw new NotFoundException('Screening result not found.');
    }
    if (result.superseded) {
      throw this.refusal(ScreeningReason.RESULT_SUPERSEDED);
    }
    if (result.reviewedAt) {
      throw this.refusal(ScreeningReason.RESULT_ALREADY_REVIEWED);
    }
    if (result.performedBy && result.performedBy === actorId) {
      throw new ForbiddenException({
        code: ScreeningReason.REVIEWER_IS_PERFORMER,
        message: SCREENING_MESSAGES[ScreeningReason.REVIEWER_IS_PERFORMER],
      });
    }

    await this.db.$transaction(async (tx) => {
      // Claimed, so two reviewers cannot both record themselves as the one who
      // reviewed it.
      const claimed = await tx.screeningResult.updateMany({
        where: { id: resultId, reviewedAt: null, superseded: false },
        data: {
          reviewedBy: actorId,
          reviewedAt: new Date(),
          comment: input.note ?? undefined,
        },
      });

      if (claimed.count === 0) {
        throw this.refusal(ScreeningReason.RESULT_ALREADY_REVIEWED);
      }

      await this.advanceOrderStatus(tx, result.screeningOrderId);
    });

    await this.audit.log({
      actorId,
      action: 'SCREENING_RESULT_REVIEWED',
      entityType: 'ScreeningResult',
      entityId: resultId,
      organizationId,
      metadata: {
        screeningOrderId: result.screeningOrderId,
        requirementCode: result.requirementCode,
        disposition: result.disposition,
      },
      ipAddress,
    });

    return { data: { id: resultId, reviewedAt: new Date(), reviewedBy: actorId } };
  }

  /**
   * Correct a result.
   *
   * Nothing is overwritten. The original row stays exactly as it was recorded
   * and is marked superseded; a new row carries the corrected value; a revision
   * joins the two with the reason and the actor. "What did we know, and when"
   * stays answerable, which is the only reason a look-back can work.
   *
   * Where the correction makes the meaning WORSE than the one a component was
   * released on, a recall opens in the same transaction. Not afterwards, not on
   * a queue: a correction that commits while its recall fails would leave the
   * system believing the new result and nobody told.
   */
  async correctResult(
    organizationId: string,
    resultId: string,
    actorId: string,
    input: {
      resultCode: string;
      resultValue?: string | null;
      reason: string;
      comment?: string | null;
      confidentialComment?: string | null;
    },
    ipAddress?: string,
  ) {
    await this.orders.assertScreeningStaffFor(actorId, organizationId);

    const original = await this.db.screeningResult.findFirst({
      where: { id: resultId, screeningOrder: { organizationId } },
      include: {
        screeningOrder: {
          include: {
            policy: { include: { dispositionRules: true, requirements: true } },
            donation: { select: { id: true, donorId: true, donationReference: true } },
          },
        },
      },
    });

    if (!original) {
      throw new NotFoundException('Screening result not found.');
    }
    if (original.superseded) {
      throw this.refusal(ScreeningReason.RESULT_SUPERSEDED);
    }
    if (original.resultCode.trim().toUpperCase() === input.resultCode.trim().toUpperCase()) {
      throw this.refusal(ScreeningReason.CORRECTION_IS_NOT_A_CHANGE);
    }

    const order = original.screeningOrder;

    const corrected = resolveDisposition(
      original.requirementCode,
      input.resultCode,
      order.policy.dispositionRules,
      order.policyVersion,
    );

    // Which components of this donation have already been released on the
    // strength of the result being corrected. Read BEFORE the transaction so
    // the decision to recall is made on the same facts the operator sees.
    const releasedComponents = await this.db.bloodUnit.count({
      where: { donationId: order.donationId, clinicalReleasedAt: { not: null } },
    });

    // A correction that makes the meaning worse. "Worse" is deliberately
    // coarse: anything that was satisfying a requirement and no longer does.
    // A correction in the other direction -- from blocked to clear -- is still
    // recorded, still audited, and opens nothing: it cannot make blood that has
    // already gone out less safe.
    const wasSatisfying = original.disposition === SafetyDisposition.CLEAR;
    const nowSatisfying = satisfiesRequirement(corrected);
    const worsens = wasSatisfying && !nowSatisfying;
    const shouldRecall = worsens && releasedComponents > 0;

    const outcome = await this.db.$transaction(async (tx) => {
      // Claimed. Two concurrent corrections of the same result would otherwise
      // both supersede it and leave two live rows for one requirement.
      const claimed = await tx.screeningResult.updateMany({
        where: { id: resultId, superseded: false },
        data: { superseded: true, supersededAt: new Date() },
      });

      if (claimed.count === 0) {
        throw this.refusal(ScreeningReason.RESULT_SUPERSEDED);
      }

      const replacement = await tx.screeningResult.create({
        data: {
          screeningOrderId: order.id,
          requirementId: original.requirementId,
          requirementCode: original.requirementCode,
          sampleId: original.sampleId,
          resultCode: input.resultCode,
          resultValue: input.resultValue ?? null,
          disposition: corrected.disposition,
          dispositionPolicyVersion: corrected.policyVersion,
          source: original.source,
          methodReference: original.methodReference,
          reagentReference: original.reagentReference,
          reagentLot: original.reagentLot,
          reagentExpiresAt: original.reagentExpiresAt,
          analyzerReference: original.analyzerReference,
          performedBy: actorId,
          performedAt: new Date(),
          receivedAt: original.receivedAt,
          comment: input.comment ?? null,
          confidentialComment: input.confidentialComment ?? null,
          // Deliberately NOT carried over: `reviewedBy` and `reviewedAt`. A
          // corrected result has not been reviewed, whatever was true of the
          // value it replaces.
        },
      });

      let recallCaseId: string | null = null;
      let openedRecall: Awaited<
        ReturnType<RecallService['openForDonationInTransaction']>
      > | null = null;

      if (shouldRecall) {
        const opened = await this.recall.openForDonationInTransaction(tx, {
          donationId: order.donationId,
          organizationId,
          triggerKind: RecallTrigger.SCREENING_RESULT_CORRECTED,
          reasonCode: 'SCREENING_RESULT_CORRECTED',
          // Operational, and safe to show a hospital: what they must do.
          operationalReason:
            'A screening result for this donation has been corrected. Quarantine any component from it and await instructions from the collecting organization.',
          // The clinical side of the correction stays with the organization
          // that opened the case.
          confidentialDetail: input.confidentialComment ?? null,
          openedBy: actorId,
        });
        recallCaseId = opened.id;
        openedRecall = opened;
      }

      await tx.screeningResultRevision.create({
        data: {
          originalResultId: original.id,
          replacementResultId: replacement.id,
          originalResultCode: original.resultCode,
          correctedResultCode: input.resultCode,
          originalDisposition: original.disposition,
          correctedDisposition: corrected.disposition,
          reason: input.reason,
          correctedBy: actorId,
          recallCaseId,
        },
      });

      let reviewTriggerId: string | null = null;

      if (requiresDonorReview(corrected)) {
        const trigger = await this.donorReview.openInTransaction(tx, {
          donorId: order.donation.donorId,
          organizationId,
          sourceKind: SCREENING_REVIEW_SOURCE,
          screeningOrderId: order.id,
          screeningResultId: replacement.id,
          triggerDisposition: corrected.disposition,
          raisedBy: actorId,
          systemRaised: true,
        });
        reviewTriggerId = trigger.id;
      }

      await this.advanceOrderStatus(tx, order.id);

      return { replacement, recallCaseId, reviewTriggerId, openedRecall };
    });

    await this.audit.log({
      actorId,
      action: 'SCREENING_RESULT_CORRECTED',
      entityType: 'ScreeningResult',
      entityId: outcome.replacement.id,
      organizationId,
      metadata: {
        originalResultId: original.id,
        screeningOrderId: order.id,
        donationId: order.donationId,
        requirementCode: original.requirementCode,
        originalResultCode: original.resultCode,
        correctedResultCode: input.resultCode,
        originalDisposition: original.disposition,
        correctedDisposition: corrected.disposition,
        reason: input.reason,
        releasedComponentsAtCorrection: releasedComponents,
        recallOpened: outcome.recallCaseId !== null,
        recallCaseId: outcome.recallCaseId,
        medicalReviewOpened: outcome.reviewTriggerId !== null,
      },
      ipAddress,
    });

    // The recall gets its own audit entry, not a mention inside the
    // correction's.
    //
    // A recall opened by hand writes RECALL_CASE_OPENED; one opened
    // automatically by a correction wrote nothing, so "when was this recall
    // opened, and by what" was answerable for the deliberate case and not for
    // the automatic one -- which is the case an incident review actually asks
    // about. Both write the same action now.
    if (outcome.openedRecall) {
      await this.audit.log({
        actorId,
        action: 'RECALL_CASE_OPENED',
        entityType: 'RecallCase',
        entityId: outcome.openedRecall.id,
        organizationId,
        metadata: {
          recallReference: outcome.openedRecall.recallReference,
          donationId: order.donationId,
          triggerKind: RecallTrigger.SCREENING_RESULT_CORRECTED,
          reasonCode: 'SCREENING_RESULT_CORRECTED',
          correctedResultId: outcome.replacement.id,
          affectedCount: outcome.openedRecall.affectedCount,
          quarantinedCount: outcome.openedRecall.quarantinedCount,
          alreadyTransfusedCount: outcome.openedRecall.alreadyTransfusedCount,
        },
        ipAddress,
      });
    }

    // Announced after the transaction committed, for the reason
    // `RecallService.announce` gives: a notification sent from inside a
    // transaction that then rolls back tells a hospital to quarantine blood
    // for a recall that does not exist, and nothing can un-send it.
    if (outcome.openedRecall) {
      this.recall.announce(outcome.openedRecall);
    }

    return {
      data: {
        id: outcome.replacement.id,
        supersededResultId: original.id,
        resultCode: outcome.replacement.resultCode,
        disposition: outcome.replacement.disposition,
        dispositionMapped: corrected.mapped,
        recallOpened: outcome.recallCaseId !== null,
        recallCaseId: outcome.recallCaseId,
        /**
         * Reported so an operator is never left to infer it. A correction that
         * worsens the meaning of a result on a donation with no released
         * component opens no recall, and that is correct -- but it must be
         * VISIBLE that no recall was opened and why.
         */
        releasedComponentsAtCorrection: releasedComponents,
        medicalReviewOpened: outcome.reviewTriggerId !== null,
      },
    };
  }

  /**
   * Move the order to the status its results justify.
   *
   * Never to COMPLETED on the strength of results alone when the policy
   * requires review: an order whose every requirement has an unreviewed result
   * is AWAITING_REVIEW, which is a different sentence and has to stay one.
   */
  private async advanceOrderStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.screeningOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        policy: { include: { requirements: true } },
        results: { where: { superseded: false } },
      },
    });

    if (
      order.status === ScreeningOrderStatus.CANCELLED ||
      order.status === ScreeningOrderStatus.COMPLETED
    ) {
      return;
    }

    const codes = new Set(order.results.map((result) => result.requirementCode));
    const everyRequirementAnswered = order.policy.requirements.every((requirement) =>
      codes.has(requirement.code),
    );

    if (!everyRequirementAnswered) {
      if (order.status === ScreeningOrderStatus.OPEN && order.results.length > 0) {
        await tx.screeningOrder.update({
          where: { id: orderId },
          data: { status: ScreeningOrderStatus.IN_PROGRESS },
        });
      }
      return;
    }

    const everyResultReviewed = order.results.every((result) => result.reviewedAt !== null);

    if (order.policy.requiresResultReview && !everyResultReviewed) {
      await tx.screeningOrder.update({
        where: { id: orderId },
        data: { status: ScreeningOrderStatus.AWAITING_REVIEW },
      });
      return;
    }

    await tx.screeningOrder.update({
      where: { id: orderId },
      data: {
        status: ScreeningOrderStatus.COMPLETED,
        completedAt: new Date(),
        // Who signed the order off as a whole, when review is what completed
        // it. Null when the policy does not require review, because nobody did.
        ...(order.policy.requiresResultReview
          ? {
              reviewedAt: new Date(),
              reviewedBy:
                order.results.find((result) => result.reviewedBy)?.reviewedBy ?? null,
            }
          : {}),
      },
    });
  }

  private refusal(reasonCode: ScreeningReasonCode): ConflictException {
    return new ConflictException({
      code: reasonCode,
      message: SCREENING_MESSAGES[reasonCode],
    });
  }

  /** Re-exported so the release gate resolves dispositions the same way. */
  static resolve(
    requirementCode: string,
    resultCode: string,
    rules: Parameters<typeof resolveDisposition>[2],
    policyVersion: number,
  ): DispositionResolution {
    return resolveDisposition(requirementCode, resultCode, rules, policyVersion);
  }
}
