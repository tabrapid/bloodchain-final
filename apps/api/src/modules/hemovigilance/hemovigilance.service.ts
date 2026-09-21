import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DispositionType,
  HemovigilanceStatus,
  RoleCode,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/** Roles entitled to report and investigate transfusion-related events. */
export const HEMOVIGILANCE_ROLES: RoleCode[] = [
  RoleCode.HOSPITAL_ADMIN,
  RoleCode.HOSPITAL_STAFF,
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
];

/**
 * Transfusion-related events, reported after a component was given.
 *
 * GENERIC BY DESIGN, and the design is the point. `eventCode` references a
 * vocabulary that ships empty, because transfusion reaction categories are
 * clinical content nobody has validated for this project (CR-08). Nothing here
 * classifies, grades or names a reaction, and nothing infers one from another:
 * an event reported against a component is a report, not a finding.
 *
 * ## Transfusion is final
 *
 * A transfusion cannot be undone, and this service is one of the two places
 * that has to hold that line (the other is the recall path). A component with a
 * TRANSFUSED disposition stays transfused no matter what is reported about it
 * afterwards, no matter what a recall later concludes, and no matter who asks.
 * Reporting an event does not un-transfuse a unit, does not return it to stock,
 * and does not change its status. What it does is create a record that a
 * look-back can find.
 *
 * ## Whose event it is
 *
 * The organisation that transfused the component reports it, and owns the
 * clinical narrative. A blood centre linked in through a recall learns that an
 * event exists against a component it issued and what it obliges them to do --
 * `operationalSummary` -- and nothing else. The recipient is an opaque,
 * organisation-scoped reference exactly as Sprint 9 left it: the same string at
 * two hospitals is two different people.
 */
@Injectable()
export class HemovigilanceService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  private generateEventReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `HV-${year}-${random}`;
  }

  /**
   * Report an event against a component.
   *
   * The component is optional. An event can be reported when the unit involved
   * is not yet identified, and refusing the report until it is would lose the
   * report -- which is the one thing a hemovigilance system must not do.
   */
  async report(
    organizationId: string,
    actorId: string,
    input: {
      bloodUnitId?: string | null;
      recipientReference?: string | null;
      encounterReference?: string | null;
      eventCode?: string | null;
      occurredAt?: string | null;
      confidentialNarrative?: string | null;
      operationalSummary?: string | null;
    },
    ipAddress?: string,
  ) {
    await this.assertHemovigilanceStaff(actorId, organizationId);

    if (input.bloodUnitId) {
      // The component has to be one this organisation actually held. Reporting
      // an event against somebody else's unit is not a report, it is an
      // assertion about a component you never touched.
      const unit = await this.db.bloodUnit.findFirst({
        where: {
          id: input.bloodUnitId,
          OR: [{ organizationId }, { disposition: { organizationId } }],
        },
        select: { id: true },
      });

      if (!unit) {
        throw new NotFoundException(
          'That component is not, and has not been, held by this organization.',
        );
      }
    }

    const event = await this.db.hemovigilanceEvent.create({
      data: {
        eventReference: this.generateEventReference(),
        organizationId,
        bloodUnitId: input.bloodUnitId ?? null,
        recipientReference: input.recipientReference ?? null,
        encounterReference: input.encounterReference ?? null,
        // Stored verbatim and uninterpreted. No classification is applied,
        // because none has been validated.
        eventCode: input.eventCode ?? null,
        status: HemovigilanceStatus.REPORTED,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        reportedBy: actorId,
        confidentialNarrative: input.confidentialNarrative ?? null,
        operationalSummary: input.operationalSummary ?? null,
      },
    });

    await this.audit.log({
      actorId,
      action: 'HEMOVIGILANCE_EVENT_REPORTED',
      entityType: 'HemovigilanceEvent',
      entityId: event.id,
      organizationId,
      // The reference and the code. Never the narrative, and never the
      // recipient reference: it identifies a person within this organisation.
      metadata: {
        eventReference: event.eventReference,
        bloodUnitId: event.bloodUnitId,
        eventCode: event.eventCode,
      },
      ipAddress,
    });

    return { data: this.serialize(event, organizationId) };
  }

  /** Record investigation progress. Does not conclude anything about the component. */
  async investigate(
    organizationId: string,
    eventId: string,
    actorId: string,
    input: { investigationNote: string },
    ipAddress?: string,
  ) {
    await this.assertHemovigilanceStaff(actorId, organizationId);
    const event = await this.assertOwnEvent(eventId, organizationId);

    if (event.status === HemovigilanceStatus.CLOSED) {
      throw new ConflictException('This event is closed.');
    }

    const updated = await this.db.hemovigilanceEvent.update({
      where: { id: eventId },
      data: {
        status: HemovigilanceStatus.UNDER_INVESTIGATION,
        investigationNote: input.investigationNote,
      },
    });

    await this.audit.log({
      actorId,
      action: 'HEMOVIGILANCE_EVENT_UNDER_INVESTIGATION',
      entityType: 'HemovigilanceEvent',
      entityId: eventId,
      organizationId,
      metadata: { eventReference: updated.eventReference },
      ipAddress,
    });

    return { data: this.serialize(updated, organizationId) };
  }

  /** Close an event. Closing changes nothing about the component. */
  async close(
    organizationId: string,
    eventId: string,
    actorId: string,
    input: { investigationNote?: string },
    ipAddress?: string,
  ) {
    await this.assertHemovigilanceStaff(actorId, organizationId);
    await this.assertOwnEvent(eventId, organizationId);

    const claimed = await this.db.hemovigilanceEvent.updateMany({
      where: { id: eventId, organizationId, status: { not: HemovigilanceStatus.CLOSED } },
      data: {
        status: HemovigilanceStatus.CLOSED,
        closedAt: new Date(),
        closedBy: actorId,
        ...(input.investigationNote ? { investigationNote: input.investigationNote } : {}),
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This event is already closed.');
    }

    const updated = await this.db.hemovigilanceEvent.findUniqueOrThrow({ where: { id: eventId } });

    await this.audit.log({
      actorId,
      action: 'HEMOVIGILANCE_EVENT_CLOSED',
      entityType: 'HemovigilanceEvent',
      entityId: eventId,
      organizationId,
      metadata: { eventReference: updated.eventReference },
      ipAddress,
    });

    return { data: this.serialize(updated, organizationId) };
  }

  /**
   * Link an event to a recall, so a look-back finds both.
   *
   * Either side may link: a hospital that reported an event and then learns of
   * a recall, or a blood centre opening a recall that a hospital's report
   * prompted. Linking exposes the event's `operationalSummary` to the recall's
   * participants and nothing more -- the narrative stays with the organisation
   * that wrote it.
   */
  async linkToRecall(
    organizationId: string,
    eventId: string,
    recallCaseId: string,
    actorId: string,
    ipAddress?: string,
  ) {
    await this.assertHemovigilanceStaff(actorId, organizationId);
    await this.assertOwnEvent(eventId, organizationId);

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
      throw new NotFoundException('Recall case not found.');
    }

    const updated = await this.db.hemovigilanceEvent.update({
      where: { id: eventId },
      data: { recallCaseId },
    });

    await this.audit.log({
      actorId,
      action: 'HEMOVIGILANCE_EVENT_LINKED_TO_RECALL',
      entityType: 'HemovigilanceEvent',
      entityId: eventId,
      organizationId,
      metadata: { eventReference: updated.eventReference, recallCaseId },
      ipAddress,
    });

    return { data: this.serialize(updated, organizationId) };
  }

  /** Events this organization reported. */
  async listOwn(
    organizationId: string,
    actorId: string,
    filters: { status?: HemovigilanceStatus },
  ) {
    await this.assertHemovigilanceStaff(actorId, organizationId);

    const events = await this.db.hemovigilanceEvent.findMany({
      where: { organizationId, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: { reportedAt: 'desc' },
      take: 100,
    });

    return { data: events.map((event) => this.serialize(event, organizationId)) };
  }

  /**
   * Events linked to a recall, as the organizations in that recall may see
   * them.
   *
   * This is the cross-organisation read, and the projection is the narrow one:
   * that an event exists, against which component, at what status, with the
   * operational summary its reporter chose to share. No narrative, no
   * recipient, no encounter.
   */
  async listForRecall(organizationId: string, recallCaseId: string, actorId: string) {
    await this.assertHemovigilanceStaff(actorId, organizationId);

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
      throw new NotFoundException('Recall case not found.');
    }

    const events = await this.db.hemovigilanceEvent.findMany({
      where: { recallCaseId },
      orderBy: { reportedAt: 'desc' },
      select: {
        id: true,
        eventReference: true,
        organizationId: true,
        bloodUnitId: true,
        eventCode: true,
        status: true,
        occurredAt: true,
        reportedAt: true,
        operationalSummary: true,
      },
    });

    return {
      data: events.map((event) => ({
        ...event,
        reportedByThisOrganization: event.organizationId === organizationId,
      })),
    };
  }

  /**
   * Whether a component has been transfused, answered from the disposition and
   * never from the status.
   *
   * Exists as a named method because the mistake it prevents is the whole of
   * Sprint 10's safety rule in miniature: `BloodUnitStatus.USED` means the unit
   * left stock, which a unit does by being issued, shipped, discarded at a
   * hospital or transfused. Only the disposition says which.
   */
  async isTransfused(bloodUnitId: string): Promise<boolean> {
    const disposition = await this.db.bloodUnitDisposition.findUnique({
      where: { bloodUnitId },
      select: { type: true },
    });

    return disposition?.type === DispositionType.TRANSFUSED;
  }

  private serialize(
    event: {
      id: string;
      eventReference: string;
      organizationId: string;
      bloodUnitId: string | null;
      recipientReference: string | null;
      encounterReference: string | null;
      eventCode: string | null;
      status: HemovigilanceStatus;
      occurredAt: Date | null;
      reportedAt: Date;
      confidentialNarrative: string | null;
      operationalSummary: string | null;
      investigationNote: string | null;
      closedAt: Date | null;
      recallCaseId: string | null;
    },
    readerOrganizationId: string,
  ) {
    const own = event.organizationId === readerOrganizationId;

    return {
      id: event.id,
      eventReference: event.eventReference,
      bloodUnitId: event.bloodUnitId,
      eventCode: event.eventCode,
      status: event.status,
      occurredAt: event.occurredAt,
      reportedAt: event.reportedAt,
      operationalSummary: event.operationalSummary,
      recallCaseId: event.recallCaseId,
      // Present as keys at all only for the reporting organisation. An explicit
      // null would tell a reader that a narrative exists and is being withheld,
      // which is itself information about a patient.
      ...(own
        ? {
            recipientReference: event.recipientReference,
            encounterReference: event.encounterReference,
            confidentialNarrative: event.confidentialNarrative,
            investigationNote: event.investigationNote,
            closedAt: event.closedAt,
          }
        : {}),
    };
  }

  private async assertOwnEvent(eventId: string, organizationId: string) {
    const event = await this.db.hemovigilanceEvent.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    if (event.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This event was reported by another organization. Only that organization can act on it.',
      );
    }

    return event;
  }

  private async assertHemovigilanceStaff(actorId: string, organizationId: string): Promise<void> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, organizationId, status: 'ACTIVE' },
      include: { role: true },
    });

    if (!memberships.some((membership) => HEMOVIGILANCE_ROLES.includes(membership.role.code))) {
      throw new ForbiddenException('You do not have permission to manage hemovigilance here.');
    }
  }
}
