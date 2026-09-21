import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalReleasePolicy,
  ClinicalReleasePolicyKind,
  ClinicalReleaseRequirement,
  DonationSampleStatus,
  DonationStatus,
  Prisma,
  RoleCode,
  ScreeningOrderStatus,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ClinicalReleaseService } from '../clinical-release/clinical-release.service';
import { SCREENING_MESSAGES, ScreeningReason, ScreeningReasonCode } from './screening.reasons';

/** Roles entitled to run blood-bank screening at an organization. */
export const SCREENING_ROLES: RoleCode[] = [
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
];

/** Why an automatic order was not raised. Never an exception: see below. */
export type ScreeningOrderSkip = {
  raised: false;
  reasonCode: ScreeningReasonCode;
  message: string;
};

export type ScreeningOrderRaised = {
  raised: true;
  orderId: string;
  orderReference: string;
  policyId: string;
  policyVersion: number;
  requirementCodes: string[];
};

export type ScreeningOrderOutcome = ScreeningOrderRaised | ScreeningOrderSkip;

/**
 * The work item that pins screening to the policy it was ordered under.
 *
 * Sprint 10's non-negotiable rule is that none of these facts implies the next:
 * a donation was completed, a sample was collected, screening was ordered,
 * results were entered, results were reviewed, a component was released. This
 * service owns exactly one link in that chain -- "screening was ordered" -- and
 * is careful never to imply either of its neighbours. Completing a donation
 * raises an order; raising an order says nothing about whether anybody has
 * tested anything.
 *
 * The pinning is the point of the model. `policyVersion` is written onto the
 * order as a column, so approving version 4 tomorrow cannot silently rewrite
 * what version 3 required of a donation screened today. Results are recorded
 * against the requirement codes the order was raised under, and the release
 * gate asks the policy in force at release time what those raw codes mean now
 * (see `ClinicalReleaseService.unmetRequirements`). History stays history;
 * interpretation stays current.
 */
@Injectable()
export class ScreeningOrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly clinicalRelease: ClinicalReleaseService,
  ) {}

  private generateOrderReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `SCR-${year}-${random}`;
  }

  private generateSampleReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `SMP-${year}-${random}`;
  }

  /**
   * Raise the screening order for a donation, inside the caller's transaction.
   *
   * Called by donation completion. It returns a skip rather than throwing when
   * no policy is in force, and that asymmetry is deliberate: the blood is
   * already in the bag by the time this runs, and refusing to record a donation
   * that physically happened would lose the only record of it. What must not
   * happen is the opposite -- an unscreened unit reaching a patient -- and that
   * is prevented at the release gate, which refuses a unit with no approved
   * policy regardless of whether an order exists.
   *
   * The caller audits the skip. A screening order that was never raised is a
   * fact somebody needs to be able to find.
   */
  async raiseForDonationInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      donationId: string;
      organizationId: string;
      requestedBy: string | null;
      systemRaised: boolean;
      /** The policy already resolved by the caller, when it has one. */
      policy?: (ClinicalReleasePolicy & { requirements: ClinicalReleaseRequirement[] }) | null;
      orderReference?: string;
    },
  ): Promise<ScreeningOrderOutcome> {
    const policy =
      input.policy !== undefined
        ? input.policy
        : await this.clinicalRelease.getPolicyInForce(input.organizationId);

    if (!policy) {
      return this.skip(ScreeningReason.POLICY_NOT_CONFIGURED);
    }

    // A development stand-in orders screening like any other policy. It is a
    // stand-in for the requirement list, not a licence to skip the workflow,
    // and the release gate refuses it in production on its own.
    if (policy.requirements.length === 0) {
      return this.skip(ScreeningReason.POLICY_HAS_NO_REQUIREMENTS);
    }

    // One open order per donation. A second one would split the results of a
    // single bag across two work items, and "which one is authoritative" has no
    // good answer.
    const existing = await tx.screeningOrder.findFirst({
      where: {
        donationId: input.donationId,
        status: {
          in: [
            ScreeningOrderStatus.OPEN,
            ScreeningOrderStatus.IN_PROGRESS,
            ScreeningOrderStatus.AWAITING_REVIEW,
          ],
        },
      },
      select: { id: true },
    });

    if (existing) {
      return this.skip(ScreeningReason.ORDER_ALREADY_OPEN);
    }

    const order = await tx.screeningOrder.create({
      data: {
        orderReference: input.orderReference ?? this.generateOrderReference(),
        donationId: input.donationId,
        organizationId: input.organizationId,
        policyId: policy.id,
        // The column, not only the relation. This is the whole reason the
        // model exists.
        policyVersion: policy.version,
        status: ScreeningOrderStatus.OPEN,
        requestedBy: input.requestedBy,
        systemRaised: input.systemRaised,
      },
      select: { id: true, orderReference: true },
    });

    return {
      raised: true,
      orderId: order.id,
      orderReference: order.orderReference,
      policyId: policy.id,
      policyVersion: policy.version,
      requirementCodes: policy.requirements.map((requirement) => requirement.code),
    };
  }

  /** Raise an order by hand, for a donation that has one missing. */
  async createForDonation(
    organizationId: string,
    donationId: string,
    actorId: string,
    ipAddress?: string,
  ) {
    await this.assertScreeningStaff(actorId, organizationId);

    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      select: { id: true, organizationId: true, status: true, donationReference: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }
    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }

    // A completed donation, not a checked-in one. Screening is ordered against
    // blood that was actually collected.
    if (donation.status !== DonationStatus.COMPLETED) {
      throw this.refusal(ScreeningReason.DONATION_NOT_COMPLETED);
    }

    const outcome = await this.db.$transaction((tx) =>
      this.raiseForDonationInTransaction(tx, {
        donationId,
        organizationId,
        requestedBy: actorId,
        systemRaised: false,
      }),
    );

    if (!outcome.raised) {
      throw this.refusal(outcome.reasonCode);
    }

    await this.audit.log({
      actorId,
      action: 'SCREENING_ORDER_RAISED',
      entityType: 'ScreeningOrder',
      entityId: outcome.orderId,
      organizationId,
      metadata: {
        donationId,
        donationReference: donation.donationReference,
        orderReference: outcome.orderReference,
        policyId: outcome.policyId,
        policyVersion: outcome.policyVersion,
        requirementCount: outcome.requirementCodes.length,
        systemRaised: false,
      },
      ipAddress,
    });

    return { data: await this.getOrderView(outcome.orderId, organizationId) };
  }

  /**
   * Record that a sample was collected for a donation.
   *
   * A separate act from completing the donation, and separately recorded,
   * because they are separately true: a donation can complete with no sample
   * drawn, and a sample can be drawn and then rejected. The order carries no
   * sample until one is attached here.
   */
  async collectSample(
    organizationId: string,
    donationId: string,
    actorId: string,
    input: { sampleType?: string | null; notes?: string | null; orderId?: string | null },
    ipAddress?: string,
  ) {
    await this.assertScreeningStaff(actorId, organizationId);

    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }
    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException('This donation does not belong to your organization.');
    }
    if (donation.status !== DonationStatus.COMPLETED) {
      throw this.refusal(ScreeningReason.DONATION_NOT_COMPLETED);
    }

    const sample = await this.db.$transaction(async (tx) => {
      const created = await tx.donationSample.create({
        data: {
          sampleReference: this.generateSampleReference(),
          donationId,
          organizationId,
          sampleType: input.sampleType ?? null,
          status: DonationSampleStatus.COLLECTED,
          collectedBy: actorId,
          notes: input.notes ?? null,
        },
      });

      if (input.orderId) {
        const claimed = await tx.screeningOrder.updateMany({
          where: {
            id: input.orderId,
            organizationId,
            donationId,
            sampleId: null,
            status: { in: [ScreeningOrderStatus.OPEN, ScreeningOrderStatus.IN_PROGRESS] },
          },
          data: { sampleId: created.id },
        });

        if (claimed.count === 0) {
          throw this.refusal(ScreeningReason.ORDER_NOT_OPEN);
        }
      }

      return created;
    });

    await this.audit.log({
      actorId,
      action: 'DONATION_SAMPLE_COLLECTED',
      entityType: 'DonationSample',
      entityId: sample.id,
      organizationId,
      // The reference and the type, never the notes: a sample note is written
      // at the bench and can carry clinical detail.
      metadata: { donationId, sampleReference: sample.sampleReference, sampleType: sample.sampleType },
      ipAddress,
    });

    return { data: this.serializeSample(sample) };
  }

  /**
   * Mark a sample unusable.
   *
   * A rejected sample does not fail the order and does not fail the donation.
   * It means another sample is needed, and until one is tested the requirements
   * stay unmet -- which the release gate already treats as a refusal.
   */
  async rejectSample(
    organizationId: string,
    sampleId: string,
    actorId: string,
    input: { rejectionReason: string },
    ipAddress?: string,
  ) {
    await this.assertScreeningStaff(actorId, organizationId);

    const claimed = await this.db.donationSample.updateMany({
      where: {
        id: sampleId,
        organizationId,
        rejectedAt: null,
        status: { not: DonationSampleStatus.REJECTED },
      },
      data: {
        status: DonationSampleStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actorId,
        rejectionReason: input.rejectionReason,
      },
    });

    if (claimed.count === 0) {
      const existing = await this.db.donationSample.findFirst({
        where: { id: sampleId, organizationId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Sample not found.');
      throw this.refusal(ScreeningReason.SAMPLE_UNUSABLE);
    }

    const sample = await this.db.donationSample.findUniqueOrThrow({ where: { id: sampleId } });

    await this.audit.log({
      actorId,
      action: 'DONATION_SAMPLE_REJECTED',
      entityType: 'DonationSample',
      entityId: sampleId,
      organizationId,
      metadata: {
        sampleReference: sample.sampleReference,
        donationId: sample.donationId,
        rejectionReason: input.rejectionReason,
      },
      ipAddress,
    });

    return { data: this.serializeSample(sample) };
  }

  /** Cancel an order. Results already recorded are untouched. */
  async cancelOrder(
    organizationId: string,
    orderId: string,
    actorId: string,
    input: { reason: string },
    ipAddress?: string,
  ) {
    await this.assertScreeningStaff(actorId, organizationId);

    const claimed = await this.db.screeningOrder.updateMany({
      where: {
        id: orderId,
        organizationId,
        status: {
          in: [
            ScreeningOrderStatus.OPEN,
            ScreeningOrderStatus.IN_PROGRESS,
            ScreeningOrderStatus.AWAITING_REVIEW,
          ],
        },
      },
      data: {
        status: ScreeningOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      },
    });

    if (claimed.count === 0) {
      const existing = await this.db.screeningOrder.findFirst({
        where: { id: orderId, organizationId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Screening order not found.');
      throw this.refusal(ScreeningReason.ORDER_NOT_OPEN);
    }

    await this.audit.log({
      actorId,
      action: 'SCREENING_ORDER_CANCELLED',
      entityType: 'ScreeningOrder',
      entityId: orderId,
      organizationId,
      metadata: { reason: input.reason },
      ipAddress,
    });

    return { data: await this.getOrderView(orderId, organizationId) };
  }

  /** The screening worklist for an organization. */
  async listOrders(
    organizationId: string,
    actorId: string,
    filters: { status?: ScreeningOrderStatus; donationId?: string; take?: number },
  ) {
    await this.assertScreeningStaff(actorId, organizationId);

    const orders = await this.db.screeningOrder.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.donationId ? { donationId: filters.donationId } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      take: Math.min(filters.take ?? 50, 200),
      include: {
        donation: { select: { id: true, donationReference: true, completedAt: true } },
        sample: { select: { id: true, sampleReference: true, status: true } },
        policy: { select: { id: true, title: true, kind: true } },
        results: {
          where: { superseded: false },
          select: {
            id: true,
            requirementCode: true,
            disposition: true,
            dispositionPolicyVersion: true,
            reviewedAt: true,
          },
        },
      },
    });

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderReference: order.orderReference,
        status: order.status,
        donationId: order.donationId,
        donationReference: order.donation.donationReference,
        sample: order.sample,
        policyId: order.policyId,
        // The pinned version, surfaced so a reviewer can see what this order
        // was raised under without reading the policy table.
        policyVersion: order.policyVersion,
        policyTitle: order.policy.title,
        developmentOnly: order.policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY,
        requestedAt: order.requestedAt,
        systemRaised: order.systemRaised,
        completedAt: order.completedAt,
        reviewedAt: order.reviewedAt,
        resultCount: order.results.length,
        reviewedResultCount: order.results.filter((result) => result.reviewedAt !== null).length,
      })),
    };
  }

  /** One order in full, for the screening console. */
  async getOrder(organizationId: string, orderId: string, actorId: string) {
    await this.assertScreeningStaff(actorId, organizationId);
    return { data: await this.getOrderView(orderId, organizationId) };
  }

  /**
   * The order, its pinned requirement list, and what has been recorded against
   * each requirement.
   *
   * The requirement list comes from the order's PINNED policy version, not from
   * whatever is in force now. A reviewer looking at an order raised three
   * months ago sees what was asked of it then.
   */
  private async getOrderView(orderId: string, organizationId: string) {
    const order = await this.db.screeningOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        donation: {
          select: { id: true, donationReference: true, donorId: true, completedAt: true },
        },
        sample: true,
        policy: { include: { requirements: true } },
        results: {
          orderBy: { createdAt: 'desc' },
          include: {
            performer: { select: { id: true, firstName: true, lastName: true } },
            reviewer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Screening order not found.');
    }

    const live = order.results.filter((result) => !result.superseded);

    return {
      id: order.id,
      orderReference: order.orderReference,
      status: order.status,
      donation: order.donation,
      sample: order.sample ? this.serializeSample(order.sample) : null,
      policy: {
        id: order.policy.id,
        title: order.policy.title,
        kind: order.policy.kind,
        developmentOnly: order.policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY,
        /** What is in force now -- shown for contrast, never used to judge. */
        currentVersion: order.policy.version,
        requiresResultReview: order.policy.requiresResultReview,
      },
      policyVersion: order.policyVersion,
      requestedAt: order.requestedAt,
      systemRaised: order.systemRaised,
      completedAt: order.completedAt,
      reviewedAt: order.reviewedAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      requirements: order.policy.requirements.map((requirement) => {
        const result = live.find((row) => row.requirementCode === requirement.code) ?? null;
        return {
          code: requirement.code,
          description: requirement.description,
          componentType: requirement.componentType,
          screeningTestCode: requirement.screeningTestCode,
          result: result
            ? {
                id: result.id,
                resultCode: result.resultCode,
                resultValue: result.resultValue,
                disposition: result.disposition,
                /**
                 * Null means no rule in the approved policy described this
                 * code, so the system defaulted to requiring a person. Shown
                 * as its own state in the console, never as a clinical answer.
                 */
                dispositionPolicyVersion: result.dispositionPolicyVersion,
                source: result.source,
                performedAt: result.performedAt,
                performedByName: result.performer
                  ? `${result.performer.firstName} ${result.performer.lastName}`
                  : null,
                reviewedAt: result.reviewedAt,
                reviewedByName: result.reviewer
                  ? `${result.reviewer.firstName} ${result.reviewer.lastName}`
                  : null,
                comment: result.comment,
              }
            : null,
        };
      }),
      /** Superseded rows, so a correction is visible as history rather than a gap. */
      supersededResults: order.results
        .filter((result) => result.superseded)
        .map((result) => ({
          id: result.id,
          requirementCode: result.requirementCode,
          resultCode: result.resultCode,
          disposition: result.disposition,
          supersededAt: result.supersededAt,
        })),
    };
  }

  private serializeSample(sample: {
    id: string;
    sampleReference: string;
    donationId: string;
    sampleType: string | null;
    status: DonationSampleStatus;
    collectedAt: Date;
    rejectedAt: Date | null;
    rejectionReason: string | null;
  }) {
    return {
      id: sample.id,
      sampleReference: sample.sampleReference,
      donationId: sample.donationId,
      sampleType: sample.sampleType,
      status: sample.status,
      collectedAt: sample.collectedAt,
      rejectedAt: sample.rejectedAt,
      rejectionReason: sample.rejectionReason,
      // `notes` is deliberately absent. It is written at the bench and can
      // carry clinical detail; nothing in a worklist needs it.
    };
  }

  private skip(reasonCode: ScreeningReasonCode): ScreeningOrderSkip {
    return { raised: false, reasonCode, message: SCREENING_MESSAGES[reasonCode] };
  }

  private refusal(reasonCode: ScreeningReasonCode): ConflictException {
    return new ConflictException({
      code: reasonCode,
      message: SCREENING_MESSAGES[reasonCode],
    });
  }

  /**
   * Who may run screening here.
   *
   * SUPER_ADMIN is NOT included, and that is not an oversight. Sprint 9 found
   * the same mistake in the deferral module: a platform administrator was being
   * treated as a clinical reader because they can reach the route. Screening is
   * a laboratory act performed at an organization; administering the platform
   * is not performing it.
   */
  private async assertScreeningStaff(actorId: string, organizationId: string): Promise<void> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, organizationId, status: 'ACTIVE' },
      include: { role: true },
    });

    const permitted = memberships.some((membership) =>
      SCREENING_ROLES.includes(membership.role.code),
    );

    if (!permitted) {
      throw new ForbiddenException({
        code: ScreeningReason.NOT_A_CLINICAL_REVIEWER,
        message: SCREENING_MESSAGES[ScreeningReason.NOT_A_CLINICAL_REVIEWER],
      });
    }
  }

  /** Exposed so the results service can apply the same rule. */
  async assertScreeningStaffFor(actorId: string, organizationId: string): Promise<void> {
    return this.assertScreeningStaff(actorId, organizationId);
  }
}
