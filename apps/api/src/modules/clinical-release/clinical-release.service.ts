import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BloodUnit,
  BloodUnitHoldStatus,
  ClinicalReleasePolicy,
  ClinicalReleasePolicyKind,
  ClinicalReleasePolicyStatus,
  ClinicalReleaseRequirement,
  ComponentType,
  ExpiryProvenance,
  Prisma,
  ReleaseDecisionOutcome,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  CLINICAL_RELEASE_MESSAGES,
  ClinicalReleaseReason,
  ClinicalReleaseReasonCode,
} from './clinical-release.reasons';

/** The subset of a unit the gate actually reads. */
export type EvaluableUnit = Pick<
  BloodUnit,
  | 'id'
  | 'unitReference'
  | 'organizationId'
  | 'componentType'
  | 'collectedAt'
  | 'expiresAt'
  | 'expirySource'
  | 'clinicalReleasedAt'
>;

type PolicyWithRequirements = ClinicalReleasePolicy & {
  requirements: ClinicalReleaseRequirement[];
};

export interface ClinicalReleaseRefusal {
  permitted: false;
  reasonCode: ClinicalReleaseReasonCode;
  message: string;
  policyId: string | null;
  policyVersion: number | null;
  policyKind: ClinicalReleasePolicyKind | null;
  unmetRequirements: string[];
}

export interface ClinicalReleaseApproval {
  permitted: true;
  policyId: string;
  policyVersion: number;
  policyKind: ClinicalReleasePolicyKind;
  /** What the unit's expiry becomes, and where that date came from. */
  expiresAt: Date;
  expirySource: ExpiryProvenance;
  /**
   * True when the decision came from a development stand-in rather than a
   * clinician. Carried all the way to the UI so a development clearance is
   * never displayed as a clinical one.
   */
  developmentOnly: boolean;
}

export type ClinicalReleaseEvaluation = ClinicalReleaseApproval | ClinicalReleaseRefusal;

/**
 * The gate between a collected bag and transfusable stock.
 *
 * Before this service, `POST .../units/:id/release` checked two things: that
 * the unit was COLLECTED or QUARANTINED, and that it belonged to the caller's
 * organisation. One staff member, one click, no test data consulted, and the
 * unit was in the fridge as available blood (CL-01, BU-01). Nothing in the
 * system knew what screening was owed, so nothing could refuse.
 *
 * This service does not fix that by deciding what must be tested -- it is not
 * entitled to, and Sprint 7 forbids inventing it. What it does is make the
 * absence explicit and fatal. With no approved policy recorded, every release
 * is refused with `CLINICAL_RELEASE_POLICY_NOT_CONFIGURED`. With an approved
 * policy that lists nothing, every release is refused too, because an empty
 * requirement set is an unanswered question rather than a clearance.
 *
 * Three properties are deliberate and tested:
 *
 * 1. **No override.** There is no actor, role or flag that skips this. The
 *    evaluation never reads who is asking, so SUPER_ADMIN gets the same answer
 *    as everyone else, and there is no force-release endpoint to call.
 * 2. **Absence is refusal.** Every "not configured", "not recorded", "not
 *    known" path ends in a refusal, never in a permit.
 * 3. **Both outcomes are recorded.** A refusal writes a `ReleaseDecision` just
 *    as a release does. "The system would not let us release this, and why" is
 *    what an incident review asks first.
 */
@Injectable()
export class ClinicalReleaseService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * The policy in force for an organisation: its own approved policy if it has
   * one, otherwise the platform-wide one. Highest version wins within a scope,
   * so recording version 2 supersedes version 1 without editing it.
   *
   * RETIRED and DRAFT policies are invisible here. A draft is by definition
   * something nobody has signed, and treating one as in force would defeat the
   * entire point of the status column.
   */
  async getPolicyInForce(
    organizationId: string,
    when: Date = new Date(),
  ): Promise<PolicyWithRequirements | null> {
    const effective: Prisma.ClinicalReleasePolicyWhereInput = {
      status: ClinicalReleasePolicyStatus.APPROVED,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: when } }] },
        { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: when } }] },
      ],
    };

    const scoped = await this.db.clinicalReleasePolicy.findFirst({
      where: { ...effective, organizationId },
      orderBy: { version: 'desc' },
      include: { requirements: true },
    });
    if (scoped) return scoped;

    return this.db.clinicalReleasePolicy.findFirst({
      where: { ...effective, organizationId: null },
      orderBy: { version: 'desc' },
      include: { requirements: true },
    });
  }

  /**
   * Decide whether a unit may become transfusable stock. Pure: it writes
   * nothing and reads nothing about the caller.
   */
  async evaluate(unit: EvaluableUnit, when: Date = new Date()): Promise<ClinicalReleaseEvaluation> {
    const policy = await this.getPolicyInForce(unit.organizationId, when);

    if (!policy) {
      return this.refuse(ClinicalReleaseReason.POLICY_NOT_CONFIGURED, null);
    }

    // A development stand-in in production is refused, not honoured. This is
    // the second of the two independent barriers between a development policy
    // and real blood -- the first is that the only thing which creates one is
    // the demo seed, which refuses to run against anything but a local
    // database.
    if (policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY && this.isProduction) {
      return this.refuse(ClinicalReleaseReason.POLICY_DEVELOPMENT_ONLY, policy);
    }

    if (policy.kind === ClinicalReleasePolicyKind.PRODUCTION) {
      const applicable = policy.requirements.filter(
        (requirement) =>
          requirement.componentType === null || requirement.componentType === unit.componentType,
      );

      // The line Sprint 7 names explicitly: an empty requirement set is not an
      // approval. A policy that lists nothing has not been finished.
      if (applicable.length === 0) {
        return this.refuse(ClinicalReleaseReason.POLICY_HAS_NO_REQUIREMENTS, policy);
      }

      const unmet = await this.unmetRequirements(unit, applicable);
      if (unmet.length > 0) {
        return this.refuse(ClinicalReleaseReason.REQUIREMENTS_NOT_MET, policy, unmet);
      }
    }

    const expiry = this.resolveExpiry(unit, policy);
    if (!expiry) {
      return this.refuse(ClinicalReleaseReason.EXPIRY_UNKNOWN, policy);
    }

    return {
      permitted: true,
      policyId: policy.id,
      policyVersion: policy.version,
      policyKind: policy.kind,
      expiresAt: expiry.expiresAt,
      expirySource: expiry.expirySource,
      developmentOnly: policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY,
    };
  }

  /**
   * Which of a policy's requirements this unit does not satisfy.
   *
   * Every one of them, today. Satisfying a requirement means a screening record
   * against this unit's donation, and no screening subsystem exists: the
   * laboratory module in this repository is donor diagnostics keyed to
   * appointments, not donation screening (CL-02, LAB-01). Rather than pretend
   * otherwise, this returns every applicable requirement code, so an approved
   * production policy refuses with an exact list of what is missing.
   *
   * This method is the seam the screening subsystem plugs into. Nothing else in
   * the release path needs to change when it arrives.
   */
  private async unmetRequirements(
    unit: EvaluableUnit,
    requirements: ClinicalReleaseRequirement[],
  ): Promise<string[]> {
    void unit;
    return requirements.map((requirement) => requirement.code);
  }

  /**
   * The unit's expiry, or null when it is genuinely unknown.
   *
   * Order matters. A shelf life the policy in force states wins, because that
   * is the authority the release is being made under. Failing that, an expiry
   * already recorded against the unit counts only if its provenance is known --
   * a date whose origin nobody can name is not evidence of anything, which is
   * why `ExpiryProvenance.UNKNOWN` is disqualifying rather than cosmetic.
   *
   * No shelf life is hard-coded here, and there is no fallback. Refusing is the
   * behaviour Sprint 7 asks for when shelf life depends on a policy that does
   * not exist yet.
   */
  private resolveExpiry(
    unit: EvaluableUnit,
    policy: ClinicalReleasePolicy,
  ): { expiresAt: Date; expirySource: ExpiryProvenance } | null {
    const shelfLifeDays =
      policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY
        ? policy.developmentShelfLifeDays
        : null;

    if (shelfLifeDays !== null && shelfLifeDays > 0) {
      const expiresAt = new Date(unit.collectedAt);
      expiresAt.setDate(expiresAt.getDate() + shelfLifeDays);
      return { expiresAt, expirySource: ExpiryProvenance.DEVELOPMENT_POLICY };
    }

    if (unit.expiresAt && unit.expirySource !== ExpiryProvenance.UNKNOWN) {
      return { expiresAt: unit.expiresAt, expirySource: unit.expirySource };
    }

    return null;
  }

  private refuse(
    reasonCode: ClinicalReleaseReasonCode,
    policy: ClinicalReleasePolicy | null,
    unmetRequirements: string[] = [],
  ): ClinicalReleaseRefusal {
    return {
      permitted: false,
      reasonCode,
      message: CLINICAL_RELEASE_MESSAGES[reasonCode],
      policyId: policy?.id ?? null,
      policyVersion: policy?.version ?? null,
      policyKind: policy?.kind ?? null,
      unmetRequirements,
    };
  }

  /**
   * Record the decision. Called for refusals and releases alike, inside the
   * caller's transaction when there is one so the row and the status change
   * cannot come apart.
   */
  async recordDecision(
    tx: Prisma.TransactionClient,
    input: {
      unitId: string;
      organizationId: string;
      evaluation: ClinicalReleaseEvaluation;
      decidedBy: string | null;
    },
  ): Promise<void> {
    const { evaluation } = input;
    await tx.releaseDecision.create({
      data: {
        bloodUnitId: input.unitId,
        organizationId: input.organizationId,
        // Copied onto the row, not read back through the relation: this has to
        // stay legible as the decision that was actually made, after the
        // policy it was made under is superseded or retired.
        policyId: evaluation.policyId,
        policyVersion: evaluation.policyVersion,
        policyKind: evaluation.policyKind,
        outcome: evaluation.permitted
          ? ReleaseDecisionOutcome.RELEASED
          : ReleaseDecisionOutcome.REFUSED,
        reasonCode: evaluation.permitted ? 'RELEASED' : evaluation.reasonCode,
        unmetRequirements: evaluation.permitted ? [] : evaluation.unmetRequirements,
        decidedBy: input.decidedBy,
      },
    });
  }

  /** The exception shape every refusal reaches a client through. */
  refusalException(refusal: ClinicalReleaseRefusal): ConflictException {
    return new ConflictException({
      code: refusal.reasonCode,
      message: refusal.message,
      details: {
        policyId: refusal.policyId,
        policyVersion: refusal.policyVersion,
        policyKind: refusal.policyKind,
        unmetRequirements: refusal.unmetRequirements,
      },
    });
  }

  /**
   * Refuse anything that would move a unit onward -- reserve, issue, ship --
   * unless it carries a release decision.
   *
   * Separate from `evaluate` on purpose. Release is a decision made once, at a
   * moment, under a named policy version; everything afterwards asks the much
   * narrower question "was that decision ever made". Re-evaluating here would
   * mean a unit legitimately released under version 1 stopped being reservable
   * the day version 2 was approved, which is a recall, not a reservation check,
   * and is not this gate's call to make.
   */
  assertReleased(unit: Pick<BloodUnit, 'clinicalReleasedAt' | 'unitReference'>): void {
    if (unit.clinicalReleasedAt) return;

    throw new ConflictException({
      code: ClinicalReleaseReason.DECISION_MISSING,
      message: CLINICAL_RELEASE_MESSAGES[ClinicalReleaseReason.DECISION_MISSING],
      details: { unitReference: unit.unitReference },
    });
  }

  /** Whether a unit carries a release decision, without throwing. */
  isReleased(unit: Pick<BloodUnit, 'clinicalReleasedAt'>): boolean {
    return unit.clinicalReleasedAt !== null;
  }

  /**
   * The where-clause fragment meaning "no active hold stands on this unit".
   *
   * Exported as data rather than as a second method because the paths that need
   * it are atomic claims: a `updateMany` guarded on status, whose whole point is
   * that the check and the write are one statement. Checking the hold
   * separately would reintroduce exactly the read-then-write race those claims
   * exist to close, so the predicate goes INTO the claim.
   *
   * Spread it into the `where` of any claim that puts a unit into or back into
   * usable stock. A claim that returns count 0 then means "status moved, or a
   * hold appeared" -- both of which are correct reasons to refuse.
   */
  static readonly NO_ACTIVE_HOLD = {
    holds: { none: { status: BloodUnitHoldStatus.ACTIVE } },
  } as const;

  /**
   * Refuse anything that would put a unit into usable stock while a hold stands.
   *
   * The companion to `assertReleased`, and needed for the same reason that one
   * is: `clinicalReleasedAt` was the only unit-level fact every downstream path
   * consulted, and a hold deliberately does not change it, or the status, or
   * anything else those paths read. Without this, a held unit that had already
   * been released would sail through every one of them.
   *
   * Takes no actor, exactly like `evaluate`. There is no role that may move a
   * held unit, so there is no parameter here for one to be passed in.
   */
  async assertNotHeld(
    db: Pick<Prisma.TransactionClient, 'bloodUnitHold'>,
    unitId: string,
    unitReference?: string,
  ): Promise<void> {
    const hold = await db.bloodUnitHold.findFirst({
      where: { bloodUnitId: unitId, status: BloodUnitHoldStatus.ACTIVE },
      orderBy: { raisedAt: 'asc' },
    });

    if (!hold) return;

    throw new ConflictException({
      code: ClinicalReleaseReason.ON_HOLD,
      message: CLINICAL_RELEASE_MESSAGES[ClinicalReleaseReason.ON_HOLD],
      // The KIND of hold is operational information the holder of the unit
      // needs. The reason TEXT is not returned: it can carry clinical detail,
      // and this refusal is read by every console.
      details: { unitReference, holdKind: hold.kind, raisedAt: hold.raisedAt },
    });
  }

  /**
   * What the consoles show at the top of the inventory screen: whether a policy
   * is configured at all, which one, and whether it is a development stand-in.
   */
  async getPolicyStatus(organizationId: string, when: Date = new Date()) {
    const policy = await this.getPolicyInForce(organizationId, when);

    if (!policy) {
      return {
        configured: false,
        reasonCode: ClinicalReleaseReason.POLICY_NOT_CONFIGURED,
        message: CLINICAL_RELEASE_MESSAGES[ClinicalReleaseReason.POLICY_NOT_CONFIGURED],
        policy: null,
      };
    }

    const usableHere =
      policy.kind !== ClinicalReleasePolicyKind.DEVELOPMENT_ONLY || !this.isProduction;

    return {
      configured: usableHere,
      reasonCode: usableHere ? null : ClinicalReleaseReason.POLICY_DEVELOPMENT_ONLY,
      message: usableHere ? null : CLINICAL_RELEASE_MESSAGES[ClinicalReleaseReason.POLICY_DEVELOPMENT_ONLY],
      policy: {
        id: policy.id,
        version: policy.version,
        kind: policy.kind,
        status: policy.status,
        title: policy.title,
        /**
         * The single field the UI keys "this is not a clinical clearance" off.
         * Never computed in a component -- one answer, from the server.
         */
        developmentOnly: policy.kind === ClinicalReleasePolicyKind.DEVELOPMENT_ONLY,
        organizationId: policy.organizationId,
        sourceReference: policy.sourceReference,
        approvedAt: policy.approvedAt,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requirementCount: policy.requirements.length,
        requirements: policy.requirements.map((requirement) => ({
          code: requirement.code,
          description: requirement.description,
          componentType: requirement.componentType as ComponentType | null,
        })),
      },
    };
  }

  /** The release history of one unit, newest first. */
  async getDecisions(unitId: string) {
    return this.db.releaseDecision.findMany({
      where: { bloodUnitId: unitId },
      orderBy: { decidedAt: 'desc' },
      include: {
        decider: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
