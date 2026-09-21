import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ConsentAcceptanceSource,
  ConsentDocumentStatus,
  ConsentPurpose,
  ConsentRequirementMode,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConsentReason, canAccept, decideConsent } from './consent.decision';

/** `organizationId`, or the platform scope. Same shape as ClinicalReleasePolicy. */
const PLATFORM_SCOPE = 'PLATFORM';
const scopeKeyFor = (organizationId?: string | null): string => organizationId ?? PLATFORM_SCOPE;

/**
 * Consent documents, acceptances, and the gate that reads them.
 *
 * No legal wording is authored anywhere in this module and none ships. What a
 * deployment presents to a donor is a document its own counsel wrote; this
 * records which one, in which language, at which version, whether anybody with
 * authority approved it, and who agreed to it.
 *
 * Approval is never automatic. A document is created DRAFT and stays DRAFT
 * until a person approves it, and an acceptance can only be recorded against an
 * APPROVED one.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  /** SHA-256 of the exact wording a version presents. */
  static hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Record a new document version.
   *
   * Always DRAFT. There is no argument that creates an approved document,
   * because "created approved" is how an unreviewed draft becomes the thing
   * donors are held to.
   */
  async createDocument(
    actorId: string,
    dto: {
      purpose: ConsentPurpose;
      locale: string;
      organizationId?: string;
      content?: string;
      contentReference?: string;
      effectiveAt?: string;
    },
    ipAddress?: string,
  ) {
    if (!dto.content && !dto.contentReference) {
      throw new BadRequestException(
        'A consent document needs either its wording or a reference to where the wording lives.',
      );
    }

    const scopeKey = scopeKeyFor(dto.organizationId);

    const latest = await this.db.consentDocument.findFirst({
      where: { scopeKey, purpose: dto.purpose, locale: dto.locale },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const document = await this.db.consentDocument.create({
      data: {
        purpose: dto.purpose,
        organizationId: dto.organizationId ?? null,
        scopeKey,
        locale: dto.locale,
        version: (latest?.version ?? 0) + 1,
        content: dto.content ?? null,
        contentReference: dto.contentReference ?? null,
        // The hash binds an acceptance to exact wording. Hashing the reference
        // when there is no inline content is deliberate: it still changes when
        // the pointer changes, so a swapped document is detectable.
        contentHash: ConsentService.hashContent(dto.content ?? dto.contentReference ?? ''),
        status: ConsentDocumentStatus.DRAFT,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : null,
      },
    });

    await this.audit.log({
      actorId,
      action: 'CONSENT_DOCUMENT_CREATED',
      entityType: 'ConsentDocument',
      entityId: document.id,
      organizationId: dto.organizationId,
      metadata: {
        purpose: document.purpose,
        locale: document.locale,
        version: document.version,
        contentHash: document.contentHash,
        status: document.status,
      },
      ipAddress,
    });

    return { data: this.projectDocument(document) };
  }

  /**
   * Approve a document version.
   *
   * A deliberate, attributed act. The approver is recorded on the row, which is
   * the only thing that distinguishes wording somebody signed off from wording
   * somebody pasted in.
   */
  async approveDocument(actorId: string, documentId: string, ipAddress?: string) {
    const document = await this.db.consentDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Consent document not found.');

    if (document.status !== ConsentDocumentStatus.DRAFT) {
      throw new ConflictException('Only a draft consent document can be approved.');
    }

    const approved = await this.db.$transaction(async (tx) => {
      const { count } = await tx.consentDocument.updateMany({
        where: { id: documentId, status: ConsentDocumentStatus.DRAFT },
        data: {
          status: ConsentDocumentStatus.APPROVED,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
      });

      if (count === 0) throw new ConflictException('Only a draft consent document can be approved.');

      // One APPROVED version per purpose, locale and scope: approving a new one
      // retires the previous, so "the document in force" is never ambiguous.
      await tx.consentDocument.updateMany({
        where: {
          scopeKey: document.scopeKey,
          purpose: document.purpose,
          locale: document.locale,
          status: ConsentDocumentStatus.APPROVED,
          id: { not: documentId },
        },
        data: { status: ConsentDocumentStatus.RETIRED, retiredAt: new Date() },
      });

      return tx.consentDocument.findUniqueOrThrow({ where: { id: documentId } });
    });

    await this.audit.log({
      actorId,
      action: 'CONSENT_DOCUMENT_APPROVED',
      entityType: 'ConsentDocument',
      entityId: documentId,
      organizationId: document.organizationId ?? undefined,
      metadata: {
        purpose: document.purpose,
        locale: document.locale,
        version: document.version,
        contentHash: document.contentHash,
      },
      ipAddress,
    });

    return { data: this.projectDocument(approved) };
  }

  /** The APPROVED document in force for a purpose and language, or null. */
  async documentInForce(
    purpose: ConsentPurpose,
    locale: string,
    organizationId?: string | null,
    when: Date = new Date(),
  ) {
    // An organisation's own document wins over the platform default, the same
    // precedence InventoryThreshold and ClinicalReleasePolicy use.
    for (const scopeKey of [scopeKeyFor(organizationId), PLATFORM_SCOPE]) {
      const document = await this.db.consentDocument.findFirst({
        where: {
          scopeKey,
          purpose,
          locale,
          status: ConsentDocumentStatus.APPROVED,
          OR: [{ effectiveAt: null }, { effectiveAt: { lte: when } }],
        },
        orderBy: { version: 'desc' },
      });

      if (document) return document;
      if (scopeKey === PLATFORM_SCOPE) break;
    }

    return null;
  }

  /** Record that a person accepted a specific version. */
  async accept(
    userId: string,
    dto: {
      purpose: ConsentPurpose;
      locale: string;
      organizationId?: string;
      source?: ConsentAcceptanceSource;
      clientReference?: string;
      context?: string;
    },
    options: { recordedBy?: string; ipAddress?: string } = {},
  ) {
    const document = await this.documentInForce(dto.purpose, dto.locale, dto.organizationId);

    if (!document) {
      // Fail closed. Nobody can agree to wording that does not exist or has not
      // been approved, so this is a refusal rather than a silently-recorded
      // acceptance of nothing.
      throw new ConflictException({
        code: ConsentReason.NO_APPROVED_DOCUMENT,
        message:
          'No approved consent document exists for this purpose and language, so consent cannot be recorded.',
        details: { purpose: dto.purpose, locale: dto.locale },
      });
    }

    const permitted = canAccept(document.status);
    if (!permitted.allowed) {
      throw new ConflictException({
        code: permitted.reason,
        message: 'Only an approved consent document can carry an acceptance.',
        details: { purpose: dto.purpose, locale: dto.locale, status: document.status },
      });
    }

    const acceptance = await this.db.consentAcceptance.create({
      data: {
        userId,
        documentId: document.id,
        // Denormalised so the record survives the document being retired and
        // the wording being superseded. See the model note.
        purpose: document.purpose,
        documentVersion: document.version,
        locale: document.locale,
        contentHash: document.contentHash,
        organizationId: dto.organizationId ?? null,
        source: dto.source ?? ConsentAcceptanceSource.MOBILE_APP,
        clientReference: dto.clientReference ?? null,
        context: dto.context ?? null,
        recordedBy: options.recordedBy ?? null,
      },
    });

    await this.audit.log({
      actorId: options.recordedBy ?? userId,
      action: 'CONSENT_ACCEPTED',
      entityType: 'ConsentAcceptance',
      entityId: acceptance.id,
      organizationId: dto.organizationId,
      metadata: {
        purpose: acceptance.purpose,
        documentVersion: acceptance.documentVersion,
        locale: acceptance.locale,
        contentHash: acceptance.contentHash,
        onBehalf: Boolean(options.recordedBy),
      },
      ipAddress: options.ipAddress,
    });

    return { data: { id: acceptance.id, purpose: acceptance.purpose, acceptedAt: acceptance.acceptedAt } };
  }

  /**
   * Withdraw consent for a purpose.
   *
   * Sets `withdrawnAt`; it never deletes the row. "Did this person ever
   * consent, to what, and when did they change their mind" has to stay
   * answerable -- that is the entire evidentiary point of a consent record.
   */
  async withdraw(userId: string, purpose: ConsentPurpose, ipAddress?: string) {
    const { count } = await this.db.consentAcceptance.updateMany({
      where: { userId, purpose, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });

    if (count === 0) {
      throw new NotFoundException('There is no live consent for this purpose to withdraw.');
    }

    await this.audit.log({
      actorId: userId,
      action: 'CONSENT_WITHDRAWN',
      entityType: 'ConsentAcceptance',
      entityId: userId,
      metadata: { purpose, withdrawnCount: count },
      ipAddress,
    });

    return { data: { purpose, withdrawn: true } };
  }

  /** The configured mode for a purpose, or null when nothing is configured. */
  async requirementMode(
    purpose: ConsentPurpose,
    organizationId?: string | null,
  ): Promise<ConsentRequirementMode | null> {
    for (const scopeKey of [scopeKeyFor(organizationId), PLATFORM_SCOPE]) {
      const row = await this.db.consentRequirement.findFirst({
        where: { scopeKey, purpose, retiredAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (row) return row.mode;
      if (scopeKey === PLATFORM_SCOPE) break;
    }

    return null;
  }

  /** Whether a purpose may currently be exercised for this person. */
  async check(userId: string, purpose: ConsentPurpose, organizationId?: string | null) {
    const mode = await this.requirementMode(purpose, organizationId);

    const [approved, acceptance] = await Promise.all([
      this.documentInForce(purpose, 'uz', organizationId).then(
        async (uz) => uz ?? (await this.anyApproved(purpose, organizationId)),
      ),
      this.db.consentAcceptance.findFirst({
        where: { userId, purpose },
        orderBy: { acceptedAt: 'desc' },
      }),
    ]);

    return decideConsent({
      mode,
      hasApprovedDocument: approved !== null,
      accepted: acceptance !== null && acceptance.withdrawnAt === null,
      withdrawn: acceptance !== null && acceptance.withdrawnAt !== null,
    });
  }

  /**
   * Refuse a feature whose purpose is not permitted.
   *
   * The gate callers use. Fails closed on every branch: an unconfigured
   * purpose, a missing approved document and an unaccepted requirement all
   * refuse, because none of them is evidence that processing is allowed.
   */
  async assertAllowed(userId: string, purpose: ConsentPurpose, organizationId?: string | null) {
    const decision = await this.check(userId, purpose, organizationId);
    if (decision.allowed) return;

    throw new ForbiddenException({
      code: decision.reason,
      message: 'This feature is not available because the consent it requires is not in place.',
      details: { purpose },
    });
  }

  private async anyApproved(purpose: ConsentPurpose, organizationId?: string | null) {
    return this.db.consentDocument.findFirst({
      where: {
        scopeKey: { in: [scopeKeyFor(organizationId), PLATFORM_SCOPE] },
        purpose,
        status: ConsentDocumentStatus.APPROVED,
      },
      orderBy: { version: 'desc' },
    });
  }

  private projectDocument(document: {
    id: string;
    purpose: ConsentPurpose;
    locale: string;
    version: number;
    status: ConsentDocumentStatus;
    contentHash: string;
    effectiveAt: Date | null;
    approvedAt: Date | null;
  }) {
    return {
      id: document.id,
      purpose: document.purpose,
      locale: document.locale,
      version: document.version,
      status: document.status,
      contentHash: document.contentHash,
      effectiveAt: document.effectiveAt,
      approvedAt: document.approvedAt,
    };
  }
}
