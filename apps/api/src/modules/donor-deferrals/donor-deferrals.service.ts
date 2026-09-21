import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeferralKind,
  DeferralSource,
  DonorDeferral,
  DonorStatus,
  Prisma,
  RoleCode,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/** Roles entitled to raise or lift a deferral. */
const DEFERRAL_ROLES: RoleCode[] = [
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
  RoleCode.HOSPITAL_ADMIN,
  RoleCode.HOSPITAL_STAFF,
];

export interface ActiveDeferralSummary {
  id: string;
  kind: DeferralKind;
  reasonCode: string | null;
  /// Deliberately absent: `confidentialNote`. This summary drives eligibility
  /// refusals and emergency-matching exclusions, which are safety decisions and
  /// need the code and the dates, never the clinician's prose.
  startsAt: Date;
  endsAt: Date | null;
  source: DeferralSource;
}

/**
 * Donor deferral, as history rather than as a flag.
 *
 * What this replaces: `DonorProfile.donorStatus = DEFERRED`, a boolean-ish
 * column with no reason, no actor, no period and no history, read by emergency
 * matching and by nothing else; and `AssessmentDecision.DEFERRED`, which was
 * recorded against one donation and reached nothing at all. Deferring a donor
 * at the chair did not stop them booking the next morning (DEF-01, DEF-05).
 *
 * Three rules hold here:
 *
 * 1. **Nothing is deleted.** Lifting sets `liftedAt`, `liftedBy` and
 *    `liftReason` on the row. The row stays, so "has this donor ever been
 *    deferred, by whom, and why" survives the lift.
 * 2. **Absence of an answer is not permission.** `isDeferredAt` is asked at
 *    booking, at check-in and during emergency matching, and a donor with an
 *    active deferral is refused in all three.
 * 3. **No clinical reasons live here.** `reasonCode` points at a vocabulary the
 *    repository ships empty, because no signed deferral schedule exists.
 *    Inventing one is what Sprint 7 forbids.
 *
 * `DonorProfile.donorStatus` is kept in step as a derived cache so existing
 * screens and filters keep working, but it is no longer the authority: every
 * gate reads the deferral rows.
 */
@Injectable()
export class DonorDeferralsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  /**
   * The predicate. True when a deferral covers `when` and nobody has lifted it.
   *
   * A deferral covers a moment when it has started (`startsAt <= when`) and has
   * either no end (`endsAt` null -- an INDEFINITE deferral) or an end still in
   * the future (`endsAt > when`).
   */
  async isDeferredAt(donorId: string, when: Date): Promise<boolean> {
    const count = await this.db.donorDeferral.count({
      where: this.activeWhere(donorId, when),
    });
    return count > 0;
  }

  /** The same answer for many donors in one query, for emergency matching. */
  async findDeferredDonorIds(donorIds: string[], when: Date): Promise<Set<string>> {
    if (donorIds.length === 0) return new Set();

    const rows = await this.db.donorDeferral.findMany({
      where: {
        donorId: { in: donorIds },
        liftedAt: null,
        startsAt: { lte: when },
        OR: [{ endsAt: null }, { endsAt: { gt: when } }],
      },
      select: { donorId: true },
      distinct: ['donorId'],
    });

    return new Set(rows.map((row) => row.donorId));
  }

  /** The deferral currently in force, or null. Newest first when several are. */
  async getActiveDeferral(donorId: string, when: Date = new Date()): Promise<ActiveDeferralSummary | null> {
    const deferral = await this.db.donorDeferral.findFirst({
      where: this.activeWhere(donorId, when),
      orderBy: { startsAt: 'desc' },
    });

    if (!deferral) return null;

    return {
      id: deferral.id,
      kind: deferral.kind,
      reasonCode: deferral.reasonCode,
      startsAt: deferral.startsAt,
      endsAt: deferral.endsAt,
      source: deferral.source,
    };
  }

  /**
   * Refuse when a deferral is in force at `when`.
   *
   * Like the recovery window, the moment is a parameter: booking asks about the
   * slot's start, check-in and emergency matching ask about now. The error
   * carries `DONOR_DEFERRED` so a client can tell it from the other reasons a
   * booking is refused without reading prose, and it deliberately does NOT
   * include the clinical reason -- a donor's own client calls these endpoints,
   * and "why" is a conversation with staff, not a field in a 409.
   */
  async assertNotDeferredAt(donorId: string, when: Date): Promise<void> {
    const deferral = await this.getActiveDeferral(donorId, when);
    if (!deferral) return;

    throw new ConflictException({
      code: 'DONOR_DEFERRED',
      message:
        'This donor is currently deferred from donating. A member of staff at the blood centre can explain and, where appropriate, lift it.',
      details: {
        kind: deferral.kind,
        startsAt: deferral.startsAt.toISOString(),
        endsAt: deferral.endsAt ? deferral.endsAt.toISOString() : null,
      },
    });
  }

  /**
   * Raise a deferral inside an existing transaction.
   *
   * Takes the transaction client rather than opening its own so that a deferral
   * raised from an assessment commits with the assessment or not at all. A
   * deferral recorded without the assessment that justified it, or an
   * assessment marked DEFERRED that deferred nobody, are both worse than the
   * operation failing.
   */
  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      donorId: string;
      organizationId: string | null;
      kind: DeferralKind;
      reasonCode?: string | null;
      confidentialNote?: string | null;
      startsAt?: Date;
      endsAt?: Date | null;
      source: DeferralSource;
      sourceDonationId?: string | null;
      createdBy: string | null;
    },
  ): Promise<DonorDeferral> {
    if (input.kind === DeferralKind.TEMPORARY && !input.endsAt) {
      throw new BadRequestException(
        'A temporary deferral needs an end date. Record it as indefinite if there is not one.',
      );
    }
    if (input.kind === DeferralKind.INDEFINITE && input.endsAt) {
      throw new BadRequestException('An indefinite deferral cannot carry an end date.');
    }

    const deferral = await tx.donorDeferral.create({
      data: {
        donorId: input.donorId,
        organizationId: input.organizationId,
        kind: input.kind,
        reasonCode: input.reasonCode ?? null,
        confidentialNote: input.confidentialNote ?? null,
        startsAt: input.startsAt ?? new Date(),
        endsAt: input.endsAt ?? null,
        source: input.source,
        sourceDonationId: input.sourceDonationId ?? null,
        createdBy: input.createdBy,
      },
    });

    // The profile flag, kept in step as a cache. Existing staff screens and
    // donor filters read it; the gates no longer do.
    await tx.donorProfile.updateMany({
      where: { userId: input.donorId },
      data: { donorStatus: DonorStatus.DEFERRED },
    });

    return deferral;
  }

  /** Raise a deferral from a staff action on the donor record. */
  async createForDonor(
    organizationId: string,
    donorId: string,
    actorId: string,
    input: {
      kind: DeferralKind;
      reasonCode?: string | null;
      confidentialNote?: string | null;
      endsAt?: string | null;
    },
    ipAddress?: string,
  ) {
    await this.assertStaffOf(actorId, organizationId);
    await this.assertDonorExists(donorId);

    const deferral = await this.db.$transaction((tx) =>
      this.createInTransaction(tx, {
        donorId,
        organizationId,
        kind: input.kind,
        reasonCode: input.reasonCode ?? null,
        confidentialNote: input.confidentialNote ?? null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        source: DeferralSource.STAFF_DECISION,
        createdBy: actorId,
      }),
    );

    await this.audit.log({
      actorId,
      action: 'DONOR_DEFERRAL_CREATED',
      entityType: 'DonorDeferral',
      entityId: deferral.id,
      organizationId,
      metadata: {
        donorId,
        kind: deferral.kind,
        reasonCode: deferral.reasonCode,
        endsAt: deferral.endsAt?.toISOString() ?? null,
        source: deferral.source,
      },
      ipAddress,
    });

    // The caller's own organisation raised it a moment ago.
    return { data: this.serialize(deferral, { includeConfidential: true }) };
  }

  /**
   * Lift a deferral. Authorized actor, a reason, and an audit entry -- all
   * three required, none of them optional.
   *
   * Nothing here is reachable by the donor: the route is staff-only, and a
   * donor's own view of their deferral is read-only by construction.
   */
  async liftDeferral(
    organizationId: string,
    deferralId: string,
    actorId: string,
    reason: string,
    ipAddress?: string,
  ) {
    await this.assertStaffOf(actorId, organizationId);

    const deferral = await this.db.donorDeferral.findUnique({ where: { id: deferralId } });
    if (!deferral) {
      throw new NotFoundException('Deferral not found.');
    }

    // Found while fixing the confidentiality defect, and the same shape of
    // mistake: `assertStaffOf` above proves the caller works for the
    // organisation in the URL, and nothing proved the deferral did. Staff of
    // one organisation could lift a deferral another organisation's clinician
    // had raised -- a clinical decision about a donor they had not assessed --
    // and the response then serialised the whole row back to them.
    //
    // Deferrals with no organisation are the ones the Sprint 7 migration
    // reconstructed from `DonorStatus.DEFERRED`. They have no owner to defend,
    // so any organisation may lift one; they also carry no note to leak.
    if (deferral.organizationId && deferral.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This deferral was raised by another organization. Only the organization that raised it can lift it.',
      );
    }

    if (deferral.liftedAt) {
      throw new ConflictException('This deferral has already been lifted.');
    }

    const now = new Date();

    const lifted = await this.db.$transaction(async (tx) => {
      // The row is updated, never deleted: the history is the point.
      const updated = await tx.donorDeferral.update({
        where: { id: deferralId },
        data: { liftedAt: now, liftedBy: actorId, liftReason: reason },
      });

      // Only return the donor to ACTIVE when nothing else still defers them.
      // Lifting one of two deferrals must not clear the other.
      const stillDeferred = await tx.donorDeferral.count({
        where: this.activeWhere(deferral.donorId, now),
      });
      if (stillDeferred === 0) {
        await tx.donorProfile.updateMany({
          where: { userId: deferral.donorId, donorStatus: DonorStatus.DEFERRED },
          data: { donorStatus: DonorStatus.ACTIVE },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorId,
      action: 'DONOR_DEFERRAL_LIFTED',
      entityType: 'DonorDeferral',
      entityId: deferralId,
      organizationId,
      metadata: { donorId: deferral.donorId, reason },
      ipAddress,
    });

    return {
      data: this.serialize(lifted, {
        includeConfidential: lifted.organizationId === organizationId,
      }),
    };
  }

  /** Every deferral a donor has ever had, newest first. Staff view. */
  /**
   * A donor's deferral history, as this organisation may see it.
   *
   * The query is still national, and deliberately so: a donor deferred at one
   * centre must not be able to donate at the next one down the road, so the
   * OTHER organisation's deferrals have to be visible here. What changes is
   * what "visible" means. A row raised by this organisation comes back whole.
   * A row raised elsewhere comes back as the minimum donor safety needs -- kind,
   * structured reason code, dates, whether it is still in force -- and without
   * the clinician's note, which belongs to the organisation whose clinician
   * wrote it.
   */
  async listForDonor(organizationId: string, donorId: string, actorId: string) {
    const { isStaffHere } = await this.assertStaffOf(actorId, organizationId);

    const deferrals = await this.db.donorDeferral.findMany({
      where: { donorId },
      orderBy: { startsAt: 'desc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        lifter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const now = new Date();
    return {
      data: {
        active: await this.getActiveDeferral(donorId, now),
        history: deferrals.map((deferral) => ({
          ...this.serialize(deferral, {
            // Both halves required: the row must belong to this organisation,
            // AND the caller must really be its clinical staff rather than an
            // administrator passing through.
            includeConfidential: isStaffHere && deferral.organizationId === organizationId,
          }),
          createdByName: deferral.creator
            ? `${deferral.creator.firstName} ${deferral.creator.lastName}`
            : null,
          liftedByName: deferral.lifter
            ? `${deferral.lifter.firstName} ${deferral.lifter.lastName}`
            : null,
        })),
      },
    };
  }

  /**
   * What a donor sees about their own deferral.
   *
   * Deliberately thin, and read-only. A donor may know that they are deferred
   * and until when, because that is what lets them plan; they may not lift it,
   * and there is no route through which they could.
   */
  async getOwnDeferral(donorId: string) {
    const active = await this.getActiveDeferral(donorId);
    return {
      data: {
        deferred: active !== null,
        kind: active?.kind ?? null,
        startsAt: active?.startsAt ?? null,
        endsAt: active?.endsAt ?? null,
        canLift: false,
      },
    };
  }

  private activeWhere(donorId: string, when: Date): Prisma.DonorDeferralWhereInput {
    return {
      donorId,
      liftedAt: null,
      startsAt: { lte: when },
      OR: [{ endsAt: null }, { endsAt: { gt: when } }],
    };
  }

  /**
   * One deferral, projected for a reader.
   *
   * `includeConfidential` is a parameter rather than a default because the
   * default was the bug: this returned the clinician's verbatim note to
   * whoever asked, and the only thing deciding who asked was which endpoint
   * they happened to call.
   */
  private serialize(deferral: DonorDeferral, options: { includeConfidential: boolean }) {
    return {
      id: deferral.id,
      donorId: deferral.donorId,
      organizationId: deferral.organizationId,
      kind: deferral.kind,
      reasonCode: deferral.reasonCode,
      ...(options.includeConfidential ? { confidentialNote: deferral.confidentialNote } : {}),
      startsAt: deferral.startsAt,
      endsAt: deferral.endsAt,
      source: deferral.source,
      sourceDonationId: deferral.sourceDonationId,
      createdBy: deferral.createdBy,
      createdAt: deferral.createdAt,
      liftedAt: deferral.liftedAt,
      liftedBy: deferral.liftedBy,
      liftReason: deferral.liftReason,
      active: deferral.liftedAt === null && (deferral.endsAt === null || deferral.endsAt > new Date()),
    };
  }

  /**
   * Staff of this organisation, or a platform administrator.
   *
   * SUPER_ADMIN is included here and nowhere near the clinical release gate,
   * and the difference is deliberate: deferral is an operational record a
   * platform administrator may legitimately correct, while releasing blood is a
   * clinical decision no administrative role is entitled to make.
   */
  /**
   * May this actor act for this organisation, and are they actually its staff?
   *
   * Two different questions, and conflating them is how a platform
   * administrator would have become a clinical reader of every organisation's
   * notes. A SUPER_ADMIN may reach these routes -- they administer the
   * platform, and locking them out of the deferral machinery would make some
   * incidents unfixable -- but administering a platform is not assessing a
   * donor, and the confidential note is written by the clinician who did.
   *
   * So the return value distinguishes them: `isStaffHere` is membership of THIS
   * organisation in a clinical role, and that, not the role's power, is what
   * unlocks the note.
   */
  private async assertStaffOf(
    actorId: string,
    organizationId: string,
  ): Promise<{ isStaffHere: boolean }> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, status: 'ACTIVE' },
      include: { role: true },
    });

    const isSuperAdmin = memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);
    const isStaffHere = memberships.some(
      (m) => m.organizationId === organizationId && DEFERRAL_ROLES.includes(m.role.code),
    );

    if (!isSuperAdmin && !isStaffHere) {
      throw new ForbiddenException('You do not have permission to manage deferrals here.');
    }

    return { isStaffHere };
  }

  private async assertDonorExists(donorId: string): Promise<void> {
    const donor = await this.db.user.findFirst({
      where: { id: donorId, donorProfile: { isNot: null } },
      select: { id: true },
    });
    if (!donor) {
      throw new NotFoundException('Donor not found.');
    }
  }
}
