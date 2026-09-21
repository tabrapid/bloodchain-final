import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DeferralKind,
  DonorReviewResolution,
  DonorReviewTriggerStatus,
  DonorStatus,
  RoleCode,
  SafetyDisposition,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorDeferralsService } from '../donor-deferrals/donor-deferrals.service';
import { DonorReviewService } from './donor-review.service';

/**
 * `MEDICAL_REVIEW_REQUIRED`, and the four things it is not.
 *
 * The Product Owner's decision is explicit: it is not a clinical deferral, not
 * a diagnosis, not permanent, and it must never silently become DEFERRED. Each
 * of those is a sentence that is easy to write and easy to violate by accident,
 * so each has a test whose failure is the violation.
 *
 * The most dangerous rule is the last one in this file: with two reviews open,
 * resolving one must not return the donor to ACTIVE. That failure is silent --
 * nothing errors, a donor simply becomes bookable while a clinician still has
 * an unanswered question about them.
 */
describe('DonorReviewService', () => {
  let service: DonorReviewService;
  let prisma: any;
  let tx: any;
  let audit: { log: jest.Mock };
  let deferrals: { createInTransaction: jest.Mock };

  const ORG = 'org-1';
  const DONOR = 'donor-1';
  const TRIGGER = 'trigger-1';

  function membership(code: RoleCode) {
    return [{ organizationId: ORG, status: 'ACTIVE', role: { code } }];
  }

  beforeEach(async () => {
    tx = {
      donorReviewTrigger: {
        create: jest.fn().mockResolvedValue({ id: TRIGGER }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      donorProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      donorDeferral: { count: jest.fn().mockResolvedValue(0) },
    };

    prisma = {
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue(membership(RoleCode.BLOOD_CENTER_STAFF)),
      },
      donorReviewTrigger: {
        findUnique: jest.fn().mockResolvedValue({
          id: TRIGGER,
          donorId: DONOR,
          organizationId: ORG,
          status: DonorReviewTriggerStatus.OPEN,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    audit = { log: jest.fn().mockResolvedValue({}) };
    deferrals = { createInTransaction: jest.fn().mockResolvedValue({ id: 'deferral-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: DonorDeferralsService, useValue: deferrals },
      ],
    }).compile();

    service = module.get(DonorReviewService);
  });

  describe('opening a review', () => {
    const open = (disposition: SafetyDisposition = SafetyDisposition.BLOCK) =>
      service.openInTransaction(tx, {
        donorId: DONOR,
        organizationId: ORG,
        sourceKind: 'BLOOD_BANK_SCREENING_RESULT',
        screeningOrderId: 'order-1',
        screeningResultId: 'result-1',
        triggerDisposition: disposition,
        raisedBy: 'staff-1',
        systemRaised: true,
      });

    it('records what raised it: the source, the references, the actor and the moment', async () => {
      await open();

      expect(tx.donorReviewTrigger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            donorId: DONOR,
            organizationId: ORG,
            status: DonorReviewTriggerStatus.OPEN,
            sourceKind: 'BLOOD_BANK_SCREENING_RESULT',
            screeningOrderId: 'order-1',
            screeningResultId: 'result-1',
            triggerDisposition: SafetyDisposition.BLOCK,
            raisedBy: 'staff-1',
            systemRaised: true,
          }),
        }),
      );
    });

    it('creates no deferral. It is not a deferral', async () => {
      await open();

      expect(deferrals.createInTransaction).not.toHaveBeenCalled();
    });

    it('moves the donor to MEDICAL_REVIEW_REQUIRED, and only from ACTIVE', async () => {
      await open();

      expect(tx.donorProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: DONOR, donorStatus: DonorStatus.ACTIVE },
        data: { donorStatus: DonorStatus.MEDICAL_REVIEW_REQUIRED },
      });
    });

    it('does not overwrite a deferral with a review', async () => {
      // The claim is guarded on ACTIVE, so a donor who is already DEFERRED
      // stays DEFERRED. Downgrading a clinical decision somebody made to a
      // request that somebody look would be a quiet loss of information.
      await open();

      const where = tx.donorProfile.updateMany.mock.calls[0][0].where;
      expect(where.donorStatus).toBe(DonorStatus.ACTIVE);
      expect(where.donorStatus).not.toBe(DonorStatus.DEFERRED);
    });

    it('refuses to open a review from a CLEAR result', async () => {
      await expect(open(SafetyDisposition.CLEAR)).rejects.toThrow(BadRequestException);
      expect(tx.donorReviewTrigger.create).not.toHaveBeenCalled();
    });
  });

  describe('who may resolve one', () => {
    const resolve = () =>
      service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

    it('refuses a platform administrator, who administers rather than assesses', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue(
        membership(RoleCode.SUPER_ADMIN),
      );

      await expect(resolve()).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a donor', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue(membership(RoleCode.DONOR));

      await expect(resolve()).rejects.toThrow(ForbiddenException);
    });

    it('refuses another organization, whose clinician is not responsible for it', async () => {
      prisma.donorReviewTrigger.findUnique.mockResolvedValue({
        id: TRIGGER,
        donorId: DONOR,
        organizationId: 'some-other-org',
        status: DonorReviewTriggerStatus.OPEN,
      });

      await expect(resolve()).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('permits an authorized clinician at the organization that raised it', async () => {
      await expect(resolve()).resolves.toBeDefined();
    });

    it('refuses to resolve one that is already resolved', async () => {
      prisma.donorReviewTrigger.findUnique.mockResolvedValue({
        id: TRIGGER,
        donorId: DONOR,
        organizationId: ORG,
        status: DonorReviewTriggerStatus.RESOLVED,
      });

      await expect(resolve()).rejects.toThrow(ConflictException);
    });

    it('refuses the loser of two concurrent resolutions', async () => {
      // Claimed, not assumed: two clinicians resolving at once must not both
      // write a deferral.
      tx.donorReviewTrigger.updateMany.mockResolvedValue({ count: 0 });

      await expect(resolve()).rejects.toThrow(ConflictException);
    });
  });

  describe('what a resolution does to the donor', () => {
    it('returns the donor to ACTIVE when nothing else stands', async () => {
      const outcome = await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

      expect(outcome.data.resultingDonorStatus).toBe(DonorStatus.ACTIVE);
      expect(tx.donorProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: DONOR, donorStatus: DonorStatus.MEDICAL_REVIEW_REQUIRED },
        data: { donorStatus: DonorStatus.ACTIVE },
      });
    });

    it('does NOT return the donor to ACTIVE while another review is open', async () => {
      // The silent failure. Nothing errors; a donor simply becomes bookable
      // while a clinician still has an unanswered question about them.
      tx.donorReviewTrigger.count.mockResolvedValue(1);

      const outcome = await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

      expect(outcome.data.resultingDonorStatus).toBe(DonorStatus.MEDICAL_REVIEW_REQUIRED);
      expect(tx.donorProfile.updateMany).not.toHaveBeenCalled();
    });

    it('counts the OTHER open reviews, excluding the one being resolved', async () => {
      await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

      expect(tx.donorReviewTrigger.count).toHaveBeenCalledWith({
        where: {
          donorId: DONOR,
          status: DonorReviewTriggerStatus.OPEN,
          id: { not: TRIGGER },
        },
      });
    });

    it('does not return the donor to ACTIVE while a deferral is in force', async () => {
      // Checking only the open reviews would let resolving a review clear a
      // deferral raised for an entirely different reason.
      tx.donorDeferral.count.mockResolvedValue(1);

      const outcome = await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

      expect(outcome.data.resultingDonorStatus).toBe(DonorStatus.DEFERRED);
      expect(tx.donorProfile.updateMany).not.toHaveBeenCalled();
    });

    it('keeps the donor under review when the clinician has looked but not concluded', async () => {
      const outcome = await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.REMAINS_UNDER_REVIEW,
      });

      expect(outcome.data.resultingDonorStatus).toBe(DonorStatus.MEDICAL_REVIEW_REQUIRED);
      // A fresh trigger carries the state forward, so the hold is never left
      // resting on a row that says RESOLVED.
      expect(tx.donorReviewTrigger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceKind: 'CLINICIAN_CONTINUED_REVIEW',
            systemRaised: false,
          }),
        }),
      );
    });
  });

  describe('the only path from a screening result to a deferral', () => {
    it('creates a deferral when, and only when, a clinician chooses one', async () => {
      const outcome = await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.TEMPORARY_DEFERRAL,
        deferralReasonCode: 'TEST_ONLY_CODE',
        deferralEndsAt: '2026-12-31T00:00:00.000Z',
        confidentialNote: 'CONFIDENTIAL clinician note',
      });

      expect(deferrals.createInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          donorId: DONOR,
          kind: DeferralKind.TEMPORARY,
          reasonCode: 'TEST_ONLY_CODE',
          createdBy: 'actor-1',
        }),
      );
      expect(outcome.data.deferralId).toBe('deferral-1');
    });

    it('refuses to defer without a structured reason code, rather than inventing one', async () => {
      await expect(
        service.resolve(ORG, TRIGGER, 'actor-1', {
          resolution: DonorReviewResolution.INDEFINITE_DEFERRAL,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a temporary deferral with no end date', async () => {
      await expect(
        service.resolve(ORG, TRIGGER, 'actor-1', {
          resolution: DonorReviewResolution.TEMPORARY_DEFERRAL,
          deferralReasonCode: 'TEST_ONLY_CODE',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('what leaves the building', () => {
    it('keeps the clinician\'s note out of the audit log', async () => {
      await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.INDEFINITE_DEFERRAL,
        deferralReasonCode: 'TEST_ONLY_CODE',
        confidentialNote: 'CONFIDENTIAL-MARKER clinician note',
        note: 'OPERATIONAL-MARKER',
      });

      const logged = JSON.stringify(audit.log.mock.calls[0][0]);
      expect(logged).not.toContain('CONFIDENTIAL-MARKER');
    });

    it('records the decision, the actor and the consequence', async () => {
      await service.resolve(ORG, TRIGGER, 'actor-1', {
        resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'DONOR_MEDICAL_REVIEW_RESOLVED',
          entityId: TRIGGER,
          metadata: expect.objectContaining({
            donorId: DONOR,
            resolution: DonorReviewResolution.RETURNED_TO_ACTIVE,
            resultingDonorStatus: DonorStatus.ACTIVE,
            createdDeferral: false,
          }),
        }),
      );
    });

    it('tells the donor a review is required, and nothing else', async () => {
      prisma.donorReviewTrigger.count.mockResolvedValue(2);

      const status = await service.getDonorFacingStatus(DONOR);
      const serialised = JSON.stringify(status);

      expect(status.medicalReviewRequired).toBe(true);
      // No disposition, no source kind, no screening reference, no
      // organisation, and no count of how many reviews stand -- each of those
      // is a hint about a clinical finding.
      expect(serialised).not.toMatch(
        /BLOCK|disposition|screening|reactive|positive|negative|infect|order/i,
      );
      expect(Object.keys(status).sort()).toEqual(['message', 'messageKey', 'medicalReviewRequired'].sort());
    });

    it('says nothing at all when no review stands', async () => {
      const status = await service.getDonorFacingStatus(DONOR);

      expect(status).toEqual({
        medicalReviewRequired: false,
        messageKey: null,
        message: null,
      });
    });
  });
});
