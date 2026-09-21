import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BloodUnitHoldKind,
  BloodUnitStatus,
  DispositionType,
  Prisma,
  RecallCaseStatus,
  RecallComponentState,
  RoleCode,
} from '@prisma/client';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { HoldsService } from '../custody/holds.service';
import {
  RECALL_OPENED_EVENT,
  type RecallOpenedPayload,
} from '../notifications/operational-notification.events';

/** Why a recall was opened. Codes, not narratives. */
export const RecallTrigger = {
  /** A screening result was corrected after a component had been released. */
  SCREENING_RESULT_CORRECTED: 'SCREENING_RESULT_CORRECTED',
  /** A transfusion-related event was reported against a component. */
  HEMOVIGILANCE_EVENT: 'HEMOVIGILANCE_EVENT',
  /** Opened by hand for a reason the operator gives. */
  MANUAL: 'MANUAL',
} as const;

export type RecallTriggerKind = (typeof RecallTrigger)[keyof typeof RecallTrigger];

/** Roles entitled to open, close and acknowledge recalls. */
export const RECALL_ROLES: RoleCode[] = [
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
  RoleCode.HOSPITAL_ADMIN,
  RoleCode.HOSPITAL_STAFF,
];

export interface OpenedRecall {
  id: string;
  recallReference: string;
  affectedCount: number;
  quarantinedCount: number;
  alreadyTransfusedCount: number;
  /**
   * Every organisation holding an affected component, plus the opener.
   *
   * Collected while the components are being walked rather than re-queried
   * afterwards: the point of a recall is that it reaches the people holding the
   * blood, and a second query is a second chance to miss one.
   */
  affectedOrganizationIds: string[];
  /** The organisation that opened the case, named rather than positional. */
  openedByOrganizationId: string;
  triggerKind: RecallTriggerKind;
  operationalReason: string | null;
}

/**
 * Recall, as a second axis rather than a status.
 *
 * The temptation with a recall is to write `status = RECALLED` onto every
 * affected component and be done. That would destroy the chain a recall exists
 * to follow: a component that was TRANSFUSED stays TRANSFUSED, because "this
 * went into a patient and we now believe it should not have" is the single most
 * important sentence a recall can produce, and it is unsayable if the status
 * has been overwritten.
 *
 * So a recall never touches `BloodUnit.status`. It records what the status WAS
 * when the recall found it (`statusAtRecall`), and tracks what the recall did
 * about each component on its own axis (`RecallComponentState`). Stopping the
 * component moving is done the way everything else in this codebase stops a
 * component moving: an active hold, which every path that puts a unit into
 * usable stock already refuses.
 *
 * Sprint 10's rule holds throughout: released is not transfused. A unit that
 * was issued to a hospital and never given to anybody is retrievable; one that
 * was transfused is not. They are different states and this service never
 * conflates them.
 */
@Injectable()
export class RecallService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly holds: HoldsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private generateRecallReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `RCL-${year}-${random}`;
  }

  /**
   * Open a recall for every component of a donation, inside the caller's
   * transaction.
   *
   * Takes the transaction client because the thing that opens a recall -- a
   * corrected screening result, most often -- must commit with it. A correction
   * that was recorded while its recall was rolled back is the worst of both
   * outcomes: the system believes the new result and nobody was told.
   */
  async openForDonationInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      donationId: string;
      organizationId: string;
      triggerKind: RecallTriggerKind;
      reasonCode?: string | null;
      /** Safe to show every affected organization: what they must DO. */
      operationalReason?: string | null;
      /** Clinical detail. Never leaves the organization that opened the case. */
      confidentialDetail?: string | null;
      openedBy: string | null;
      recallReference?: string;
    },
  ): Promise<OpenedRecall> {
    const recallCase = await tx.recallCase.create({
      data: {
        recallReference: input.recallReference ?? this.generateRecallReference(),
        organizationId: input.organizationId,
        status: RecallCaseStatus.OPEN,
        triggerKind: input.triggerKind,
        donationId: input.donationId,
        reasonCode: input.reasonCode ?? null,
        operationalReason: input.operationalReason ?? null,
        confidentialDetail: input.confidentialDetail ?? null,
        openedBy: input.openedBy,
      },
      select: { id: true, recallReference: true },
    });

    const units = await tx.bloodUnit.findMany({
      where: { donationId: input.donationId },
      select: {
        id: true,
        unitReference: true,
        organizationId: true,
        status: true,
        disposition: { select: { type: true, shipmentId: true } },
      },
    });

    let quarantined = 0;
    let alreadyTransfused = 0;
    const affectedOrganizationIds = new Set<string>([input.organizationId]);

    for (const unit of units) {
      affectedOrganizationIds.add(unit.organizationId);
      // Transfused is read from the DISPOSITION, never from the status.
      // `BloodUnitStatus.USED` means the unit left stock; a unit can be issued,
      // shipped and never given to anybody. Only a TRANSFUSED disposition says
      // it reached a patient.
      const wasTransfused = unit.disposition?.type === DispositionType.TRANSFUSED;
      const alreadyOutOfStock =
        unit.status === BloodUnitStatus.DISCARDED || unit.status === BloodUnitStatus.EXPIRED;

      let state: RecallComponentState = RecallComponentState.IDENTIFIED;
      let holdId: string | null = null;

      if (wasTransfused) {
        state = RecallComponentState.TRANSFUSED_BEFORE_RECALL;
        alreadyTransfused += 1;
      } else if (!alreadyOutOfStock) {
        // The hold belongs to the organization physically holding the unit,
        // which after a shipment is not the one opening the recall.
        const hold = await this.holds.raiseInTransaction(tx, {
          bloodUnitId: unit.id,
          organizationId: unit.organizationId,
          // QUALITY_HOLD, not REACTIVE. The kind is printed on labels and shown
          // in consoles, and naming a clinical finding there would be a claim
          // about the donor that nobody has made.
          kind: BloodUnitHoldKind.QUALITY_HOLD,
          reasonCode: 'RECALL',
          // Operational only. The confidential detail stays on the case.
          reasonText: `Recall ${recallCase.recallReference}: quarantined pending recall instructions.`,
          raisedBy: input.openedBy,
        });
        holdId = hold.id;
        state = RecallComponentState.QUARANTINED;
        quarantined += 1;
      }

      await tx.recallAffectedComponent.create({
        data: {
          recallCaseId: recallCase.id,
          bloodUnitId: unit.id,
          state,
          // A snapshot. The unit's own status is untouched by all of this.
          statusAtRecall: unit.status,
          holdingOrganizationId: unit.organizationId,
          shipmentId: unit.disposition?.shipmentId ?? null,
          holdId,
        },
      });
    }

    return {
      id: recallCase.id,
      recallReference: recallCase.recallReference,
      affectedCount: units.length,
      quarantinedCount: quarantined,
      alreadyTransfusedCount: alreadyTransfused,
      affectedOrganizationIds: [...affectedOrganizationIds],
      openedByOrganizationId: input.organizationId,
      triggerKind: input.triggerKind,
      operationalReason: input.operationalReason ?? null,
    };
  }

  /**
   * Tell the organisations holding the components, after the case has
   * committed.
   *
   * Emitted outside the transaction on purpose. A notification is an outbound
   * side effect: sent from inside a transaction that then rolls back, it tells
   * a hospital to quarantine blood for a recall that does not exist, and
   * nothing can un-send it. Emitted after commit, the worst case is a recall
   * that exists and was not announced -- which the worklist still shows and an
   * operator can re-announce.
   *
   * Carries `operationalReason` and never `confidentialDetail`: this fans out
   * to every member of every affected organisation, through push and email.
   */
  announce(opened: OpenedRecall): void {
    this.eventEmitter.emit(RECALL_OPENED_EVENT, {
      recallCaseId: opened.id,
      recallReference: opened.recallReference,
      organizationId: opened.openedByOrganizationId,
      affectedOrganizationIds: opened.affectedOrganizationIds,
      triggerKind: opened.triggerKind,
      operationalReason: opened.operationalReason,
      affectedCount: opened.affectedCount,
    } satisfies RecallOpenedPayload);
  }

  /** Open a recall by hand. */
  async openForDonation(
    organizationId: string,
    donationId: string,
    actorId: string,
    input: {
      reasonCode?: string;
      operationalReason?: string;
      confidentialDetail?: string;
    },
    ipAddress?: string,
  ) {
    await this.assertRecallStaff(actorId, organizationId);

    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      select: { id: true, organizationId: true, donationReference: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    // A recall is opened by the organization that collected the blood. A
    // hospital that receives a component and believes something is wrong with
    // it reports a hemovigilance event; it does not recall somebody else's
    // donation.
    if (donation.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This donation was collected by another organization. Report the concern to them rather than recalling their donation.',
      );
    }

    const opened = await this.db.$transaction((tx) =>
      this.openForDonationInTransaction(tx, {
        donationId,
        organizationId,
        triggerKind: RecallTrigger.MANUAL,
        reasonCode: input.reasonCode ?? null,
        operationalReason: input.operationalReason ?? null,
        confidentialDetail: input.confidentialDetail ?? null,
        openedBy: actorId,
      }),
    );

    await this.audit.log({
      actorId,
      action: 'RECALL_CASE_OPENED',
      entityType: 'RecallCase',
      entityId: opened.id,
      organizationId,
      // Counts and codes. Never `confidentialDetail`.
      metadata: {
        recallReference: opened.recallReference,
        donationId,
        donationReference: donation.donationReference,
        triggerKind: RecallTrigger.MANUAL,
        reasonCode: input.reasonCode ?? null,
        affectedCount: opened.affectedCount,
        quarantinedCount: opened.quarantinedCount,
        alreadyTransfusedCount: opened.alreadyTransfusedCount,
      },
      ipAddress,
    });

    this.announce(opened);

    return { data: await this.getCaseView(opened.id, organizationId) };
  }

  /**
   * An organization says it has seen the recall and what it did.
   *
   * Any organization holding an affected component may acknowledge, not only
   * the one that opened the case -- that is the entire point of a recall
   * reaching a hospital.
   */
  async acknowledge(
    organizationId: string,
    recallCaseId: string,
    actorId: string,
    input: { responseNote?: string },
    ipAddress?: string,
  ) {
    await this.assertRecallStaff(actorId, organizationId);
    await this.assertCaseVisible(recallCaseId, organizationId);

    const existing = await this.db.recallAcknowledgement.findUnique({
      where: { recallCaseId_organizationId: { recallCaseId, organizationId } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('This organization has already acknowledged this recall.');
    }

    const acknowledgement = await this.db.$transaction(async (tx) => {
      const created = await tx.recallAcknowledgement.create({
        data: {
          recallCaseId,
          organizationId,
          acknowledgedBy: actorId,
          responseNote: input.responseNote ?? null,
        },
      });

      // The case moves to ACKNOWLEDGED, never to CLOSED. Closing is a decision
      // the opening organization makes after looking at what came back.
      await tx.recallCase.updateMany({
        where: { id: recallCaseId, status: RecallCaseStatus.OPEN },
        data: { status: RecallCaseStatus.ACKNOWLEDGED },
      });

      return created;
    });

    await this.audit.log({
      actorId,
      action: 'RECALL_CASE_ACKNOWLEDGED',
      entityType: 'RecallCase',
      entityId: recallCaseId,
      organizationId,
      metadata: { acknowledgementId: acknowledgement.id },
      ipAddress,
    });

    return { data: await this.getCaseView(recallCaseId, organizationId) };
  }

  /**
   * Record what became of one affected component.
   *
   * Only the organization holding it may say. And note what this does NOT do:
   * it never writes `BloodUnit.status`. Destroying a recalled component is a
   * disposition, recorded through the disposition path with its own audit
   * trail; this records the recall's view of the same event.
   */
  async updateComponentState(
    organizationId: string,
    recallCaseId: string,
    componentId: string,
    actorId: string,
    input: { state: RecallComponentState; note?: string },
    ipAddress?: string,
  ) {
    await this.assertRecallStaff(actorId, organizationId);

    const component = await this.db.recallAffectedComponent.findFirst({
      where: { id: componentId, recallCaseId },
      select: { id: true, state: true, holdingOrganizationId: true, bloodUnitId: true },
    });

    if (!component) {
      throw new NotFoundException('This component is not part of that recall.');
    }

    if (component.holdingOrganizationId !== organizationId) {
      throw new ForbiddenException(
        'Only the organization holding this component can say what became of it.',
      );
    }

    // A component that was already in a patient when the recall opened cannot
    // be returned or destroyed, and saying it was would falsify the one fact
    // the recall most needs to keep.
    if (component.state === RecallComponentState.TRANSFUSED_BEFORE_RECALL) {
      throw new ConflictException(
        'This component had already been transfused when the recall opened. Its recall state cannot be changed.',
      );
    }

    await this.db.recallAffectedComponent.update({
      where: { id: componentId },
      data: { state: input.state, note: input.note ?? null },
    });

    await this.audit.log({
      actorId,
      action: 'RECALL_COMPONENT_STATE_RECORDED',
      entityType: 'RecallAffectedComponent',
      entityId: componentId,
      organizationId,
      metadata: {
        recallCaseId,
        bloodUnitId: component.bloodUnitId,
        previousState: component.state,
        state: input.state,
      },
      ipAddress,
    });

    return { data: await this.getCaseView(recallCaseId, organizationId) };
  }

  /** Close a recall. Only the organization that opened it. */
  async close(
    organizationId: string,
    recallCaseId: string,
    actorId: string,
    input: { closureNote?: string },
    ipAddress?: string,
  ) {
    await this.assertRecallStaff(actorId, organizationId);

    const recallCase = await this.db.recallCase.findUnique({
      where: { id: recallCaseId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!recallCase) {
      throw new NotFoundException('Recall case not found.');
    }
    if (recallCase.organizationId !== organizationId) {
      throw new ForbiddenException('Only the organization that opened this recall can close it.');
    }

    const claimed = await this.db.recallCase.updateMany({
      where: { id: recallCaseId, status: { not: RecallCaseStatus.CLOSED } },
      data: {
        status: RecallCaseStatus.CLOSED,
        closedAt: new Date(),
        closedBy: actorId,
        closureNote: input.closureNote ?? null,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This recall is already closed.');
    }

    await this.audit.log({
      actorId,
      action: 'RECALL_CASE_CLOSED',
      entityType: 'RecallCase',
      entityId: recallCaseId,
      organizationId,
      metadata: { closureNote: input.closureNote ?? null },
      ipAddress,
    });

    // Closing a recall does NOT lift the holds it raised. A hold is lifted by
    // the quality workflow that owns it, with its own reason and actor, and
    // lifting one as a side effect of an administrative status change is
    // exactly the kind of implicit release Sprint 9 spent itself removing.
    return { data: await this.getCaseView(recallCaseId, organizationId) };
  }

  /** Recalls this organization needs to see: ones it opened, and ones it holds components for. */
  async listCases(organizationId: string, actorId: string, filters: { status?: RecallCaseStatus }) {
    await this.assertRecallStaff(actorId, organizationId);

    const cases = await this.db.recallCase.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        OR: [
          { organizationId },
          { components: { some: { holdingOrganizationId: organizationId } } },
        ],
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: {
        components: { select: { id: true, state: true, holdingOrganizationId: true } },
        acknowledgements: { select: { organizationId: true, acknowledgedAt: true } },
      },
    });

    return {
      data: cases.map((row) => ({
        id: row.id,
        recallReference: row.recallReference,
        status: row.status,
        triggerKind: row.triggerKind,
        reasonCode: row.reasonCode,
        operationalReason: row.operationalReason,
        // Absent unless this organization opened the case. See `getCaseView`.
        ...(row.organizationId === organizationId
          ? { confidentialDetail: row.confidentialDetail }
          : {}),
        openedAt: row.openedAt,
        closedAt: row.closedAt,
        isOpener: row.organizationId === organizationId,
        myComponentCount: row.components.filter(
          (component) => component.holdingOrganizationId === organizationId,
        ).length,
        acknowledged: row.acknowledgements.some(
          (acknowledgement) => acknowledgement.organizationId === organizationId,
        ),
      })),
    };
  }

  async getCase(organizationId: string, recallCaseId: string, actorId: string) {
    await this.assertRecallStaff(actorId, organizationId);
    await this.assertCaseVisible(recallCaseId, organizationId);
    return { data: await this.getCaseView(recallCaseId, organizationId) };
  }

  /**
   * Look-back: everything that came from one donation, and where it went.
   *
   * Organization-safe by construction. A blood centre that collected the
   * donation sees the whole chain. Any other organization sees only the
   * components it actually holds or held, because "which other hospitals
   * received blood from this donor" is not a question one hospital may ask
   * another.
   *
   * The donor is never named. Look-back answers "what came from this donation";
   * who gave it is a separate question with a separate gate.
   */
  async traceForward(organizationId: string, donationId: string, actorId: string) {
    await this.assertRecallStaff(actorId, organizationId);

    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      select: {
        id: true,
        donationReference: true,
        organizationId: true,
        completedAt: true,
        collectionCompletedAt: true,
      },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }

    const isCollector = donation.organizationId === organizationId;

    const units = await this.db.bloodUnit.findMany({
      where: {
        donationId,
        ...(isCollector
          ? {}
          : {
              OR: [
                { organizationId },
                { disposition: { organizationId } },
                { shipmentUnits: { some: { shipment: { destinationOrganizationId: organizationId } } } },
              ],
            }),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        unitReference: true,
        componentType: true,
        status: true,
        organizationId: true,
        clinicalReleasedAt: true,
        expiresAt: true,
        disposition: {
          select: {
            type: true,
            occurredAt: true,
            organizationId: true,
            recipientReference: true,
          },
        },
        holds: {
          where: { status: 'ACTIVE' },
          select: { id: true, kind: true, raisedAt: true },
        },
      },
    });

    if (!isCollector && units.length === 0) {
      throw new ForbiddenException(
        'This organization holds no component from that donation, so it has no look-back to read.',
      );
    }

    return {
      data: {
        donation: {
          id: donation.id,
          donationReference: donation.donationReference,
          completedAt: donation.completedAt,
          collectionCompletedAt: donation.collectionCompletedAt,
          isCollectingOrganization: isCollector,
        },
        components: units.map((unit) => ({
          id: unit.id,
          unitReference: unit.unitReference,
          componentType: unit.componentType,
          status: unit.status,
          holdingOrganizationId: unit.organizationId,
          // Released is not transfused, and the two are reported separately
          // and without inference in either direction.
          clinicallyReleased: unit.clinicalReleasedAt !== null,
          clinicalReleasedAt: unit.clinicalReleasedAt,
          transfused: unit.disposition?.type === DispositionType.TRANSFUSED,
          dispositionType: unit.disposition?.type ?? null,
          dispositionAt: unit.disposition?.occurredAt ?? null,
          /**
           * The opaque recipient reference, and ONLY to the organization that
           * recorded it. It is organization-scoped: the same string at two
           * hospitals is two different people, so handing it to a third party
           * would be meaningless as well as wrong.
           */
          ...(unit.disposition && unit.disposition.organizationId === organizationId
            ? { recipientReference: unit.disposition.recipientReference }
            : {}),
          activeHolds: unit.holds.map((hold) => ({
            id: hold.id,
            kind: hold.kind,
            raisedAt: hold.raisedAt,
          })),
          expiresAt: unit.expiresAt,
        })),
      },
    };
  }

  /**
   * Traceback: from a component in a hospital's hands to the donation it came
   * from -- and no further.
   *
   * Deliberately stops at the donation. A hospital investigating a component is
   * entitled to know which donation produced it, so the blood centre can be
   * told which bag to look at. It is not entitled to the donor, to the donor's
   * screening results, or to the other components of the same donation held
   * elsewhere.
   */
  async traceBack(organizationId: string, bloodUnitId: string, actorId: string) {
    await this.assertRecallStaff(actorId, organizationId);

    const unit = await this.db.bloodUnit.findFirst({
      where: {
        id: bloodUnitId,
        OR: [{ organizationId }, { disposition: { organizationId } }],
      },
      select: {
        id: true,
        unitReference: true,
        componentType: true,
        status: true,
        clinicalReleasedAt: true,
        donationId: true,
        donation: {
          select: {
            id: true,
            donationReference: true,
            organizationId: true,
            completedAt: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('That component is not, and has not been, held by this organization.');
    }

    const recalls = await this.db.recallAffectedComponent.findMany({
      where: { bloodUnitId },
      select: {
        id: true,
        state: true,
        recallCase: {
          select: {
            id: true,
            recallReference: true,
            status: true,
            triggerKind: true,
            // `operationalReason` only. `confidentialDetail` is never selected
            // on a cross-organization read.
            operationalReason: true,
            openedAt: true,
          },
        },
      },
    });

    return {
      data: {
        component: {
          id: unit.id,
          unitReference: unit.unitReference,
          componentType: unit.componentType,
          status: unit.status,
          clinicallyReleased: unit.clinicalReleasedAt !== null,
        },
        donation: {
          id: unit.donation.id,
          donationReference: unit.donation.donationReference,
          completedAt: unit.donation.completedAt,
          collectedBy: unit.donation.organization
            ? { id: unit.donation.organization.id, name: unit.donation.organization.name }
            : null,
          // Absent, deliberately: the donor. A traceback names the bag, not the
          // person who gave it.
        },
        recalls: recalls.map((row) => ({
          componentId: row.id,
          state: row.state,
          ...row.recallCase,
        })),
      },
    };
  }

  private async getCaseView(recallCaseId: string, organizationId: string) {
    const row = await this.db.recallCase.findUniqueOrThrow({
      where: { id: recallCaseId },
      include: {
        donation: { select: { id: true, donationReference: true } },
        components: {
          include: {
            bloodUnit: {
              select: { id: true, unitReference: true, componentType: true, status: true },
            },
          },
        },
        acknowledgements: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });

    const isOpener = row.organizationId === organizationId;

    return {
      id: row.id,
      recallReference: row.recallReference,
      status: row.status,
      triggerKind: row.triggerKind,
      reasonCode: row.reasonCode,
      /** What every affected organization may read: what they must do. */
      operationalReason: row.operationalReason,
      /**
       * What only the opening organization may read. Present as a key at all
       * only for them -- an explicit `null` would tell a hospital that clinical
       * detail exists and is being withheld, which is itself information.
       */
      ...(isOpener ? { confidentialDetail: row.confidentialDetail } : {}),
      donation: row.donation,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      closureNote: row.closureNote,
      isOpener,
      components: row.components
        .filter((component) => isOpener || component.holdingOrganizationId === organizationId)
        .map((component) => ({
          id: component.id,
          bloodUnitId: component.bloodUnitId,
          unitReference: component.bloodUnit.unitReference,
          componentType: component.bloodUnit.componentType,
          state: component.state,
          /** The snapshot, and the live status, side by side and never merged. */
          statusAtRecall: component.statusAtRecall,
          currentStatus: component.bloodUnit.status,
          holdingOrganizationId: component.holdingOrganizationId,
          holdId: component.holdId,
          note: component.note,
        })),
      acknowledgements: row.acknowledgements.map((acknowledgement) => ({
        organizationId: acknowledgement.organizationId,
        organizationName: acknowledgement.organization.name,
        acknowledgedAt: acknowledgement.acknowledgedAt,
        responseNote: acknowledgement.responseNote,
      })),
    };
  }

  private async assertCaseVisible(recallCaseId: string, organizationId: string): Promise<void> {
    const visible = await this.db.recallCase.findFirst({
      where: {
        id: recallCaseId,
        OR: [
          { organizationId },
          { components: { some: { holdingOrganizationId: organizationId } } },
        ],
      },
      select: { id: true },
    });

    if (!visible) {
      // Not found rather than forbidden: whether a recall exists for somebody
      // else's donation is itself something this organization may not learn.
      throw new NotFoundException('Recall case not found.');
    }
  }

  private async assertRecallStaff(actorId: string, organizationId: string): Promise<void> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, organizationId, status: 'ACTIVE' },
      include: { role: true },
    });

    if (!memberships.some((membership) => RECALL_ROLES.includes(membership.role.code))) {
      throw new ForbiddenException('You do not have permission to manage recalls here.');
    }
  }
}
