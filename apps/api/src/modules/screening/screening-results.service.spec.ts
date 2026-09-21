import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SafetyDisposition, ScreeningOrderStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorReviewService } from '../donor-review/donor-review.service';
import { RecallService, RecallTrigger } from '../recall/recall.service';
import { ScreeningOrdersService } from './screening-orders.service';
import { ScreeningResultsService } from './screening-results.service';
import { ScreeningReason } from './screening.reasons';

/**
 * Recording, reviewing and correcting a screening result.
 *
 * The three separations this service exists to hold: entering a result is not
 * reviewing it, a raw result code is not a safety decision, and a result about
 * blood is not a diagnosis about a donor. Each has a way of quietly collapsing
 * and each has a test here whose failure is the collapse.
 */
describe('ScreeningResultsService', () => {
  let service: ScreeningResultsService;
  let prisma: any;
  let tx: any;
  let donorReview: { openInTransaction: jest.Mock };
  let recall: { openForDonationInTransaction: jest.Mock; announce: jest.Mock };
  let audit: { log: jest.Mock };

  const ORG = 'org-1';
  const ORDER = 'order-1';

  function policy(rules: { resultCode: string; disposition: SafetyDisposition }[], overrides = {}) {
    return {
      id: 'policy-1',
      version: 3,
      requiresResultReview: true,
      requirements: [{ id: 'req-1', code: 'REQ-A', description: null, componentType: null }],
      dispositionRules: rules.map((rule, index) => ({
        id: `rule-${index}`,
        requirementCode: 'REQ-A',
        resultCode: rule.resultCode,
        disposition: rule.disposition,
      })),
      ...overrides,
    };
  }

  function order(overrides: Record<string, any> = {}) {
    return {
      id: ORDER,
      organizationId: ORG,
      donationId: 'donation-1',
      sampleId: null,
      policyVersion: 3,
      status: ScreeningOrderStatus.OPEN,
      policy: policy([{ resultCode: 'CODE-PASS', disposition: SafetyDisposition.CLEAR }]),
      donation: { id: 'donation-1', donorId: 'donor-1', donationReference: 'DONATION-1' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    tx = {
      screeningResult: {
        create: jest.fn().mockResolvedValue({
          id: 'result-new',
          resultCode: 'CODE-PASS',
          disposition: SafetyDisposition.CLEAR,
          dispositionPolicyVersion: 3,
          performedAt: new Date(),
          reviewedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      screeningResultRevision: { create: jest.fn().mockResolvedValue({}) },
      screeningOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ORDER,
          status: ScreeningOrderStatus.OPEN,
          policy: policy([{ resultCode: 'CODE-PASS', disposition: SafetyDisposition.CLEAR }]),
          results: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      screeningOrder: { findFirst: jest.fn().mockResolvedValue(order()) },
      screeningResult: { findFirst: jest.fn() },
      donationSample: { findFirst: jest.fn() },
      bloodUnit: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    donorReview = { openInTransaction: jest.fn().mockResolvedValue({ id: 'trigger-1' }) };
    recall = {
      openForDonationInTransaction: jest.fn().mockResolvedValue({
        id: 'case-1',
        recallReference: 'RCL-1',
        affectedCount: 1,
        quarantinedCount: 1,
        alreadyTransfusedCount: 0,
        affectedOrganizationIds: [ORG],
        openedByOrganizationId: ORG,
        triggerKind: RecallTrigger.SCREENING_RESULT_CORRECTED,
        operationalReason: null,
      }),
      announce: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreeningResultsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        {
          provide: ScreeningOrdersService,
          useValue: { assertScreeningStaffFor: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: DonorReviewService, useValue: donorReview },
        { provide: RecallService, useValue: recall },
      ],
    }).compile();

    service = module.get(ScreeningResultsService);
  });

  const record = (input: Record<string, any> = {}) =>
    service.recordResult(ORG, ORDER, 'tech-1', {
      requirementCode: 'REQ-A',
      resultCode: 'CODE-PASS',
      ...input,
    } as any);

  describe('recording a result', () => {
    it('stores the raw code verbatim alongside what the policy said it means', async () => {
      await record();

      expect(tx.screeningResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resultCode: 'CODE-PASS',
            disposition: SafetyDisposition.CLEAR,
            dispositionPolicyVersion: 3,
          }),
        }),
      );
    });

    it('captures the provenance a look-back will ask for years later', async () => {
      await record({
        reagentLot: 'LOT-77',
        reagentExpiresAt: '2027-01-01T00:00:00.000Z',
        analyzerReference: 'ANALYSER-3',
        methodReference: 'METHOD-X',
      });

      const data = tx.screeningResult.create.mock.calls[0][0].data;
      expect(data.reagentLot).toBe('LOT-77');
      expect(data.reagentExpiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
      expect(data.analyzerReference).toBe('ANALYSER-3');
      expect(data.methodReference).toBe('METHOD-X');
      expect(data.performedBy).toBe('tech-1');
      expect(data.performedAt).toBeInstanceOf(Date);
    });

    it('records an unmapped code with a null policy version, not a guess', async () => {
      prisma.screeningOrder.findFirst.mockResolvedValue(order({ policy: policy([]) }));

      const result = await record({ resultCode: 'ANYTHING' });

      const data = tx.screeningResult.create.mock.calls[0][0].data;
      expect(data.disposition).toBe(SafetyDisposition.REVIEW_REQUIRED);
      expect(data.dispositionPolicyVersion).toBeNull();
      expect(result.data.dispositionMapped).toBe(false);
      expect(result.data.satisfiesRequirement).toBe(false);
    });

    it('does not put the donor under medical review for a code no policy describes', async () => {
      // With the rule table empty -- how the repository ships -- the
      // alternative would place every donor who ever gave blood under review on
      // their first result, and a flag that fires on everything is a flag
      // nobody reads.
      prisma.screeningOrder.findFirst.mockResolvedValue(order({ policy: policy([]) }));

      await record({ resultCode: 'ANYTHING' });

      expect(donorReview.openInTransaction).not.toHaveBeenCalled();
    });

    it('opens a medical review for a result the policy maps to BLOCK', async () => {
      prisma.screeningOrder.findFirst.mockResolvedValue(
        order({
          policy: policy([{ resultCode: 'CODE-BLOCK', disposition: SafetyDisposition.BLOCK }]),
        }),
      );

      const result = await record({ resultCode: 'CODE-BLOCK' });

      expect(donorReview.openInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          donorId: 'donor-1',
          triggerDisposition: SafetyDisposition.BLOCK,
          // The system raised it. Putting the technician's name on a safety
          // consequence would make the trail read as a clinical decision they
          // did not make.
          systemRaised: true,
        }),
      );
      expect(result.data.medicalReviewOpened).toBe(true);
    });

    it('opens a medical review for REVIEW_REQUIRED too', async () => {
      prisma.screeningOrder.findFirst.mockResolvedValue(
        order({
          policy: policy([
            { resultCode: 'CODE-REVIEW', disposition: SafetyDisposition.REVIEW_REQUIRED },
          ]),
        }),
      );

      await record({ resultCode: 'CODE-REVIEW' });

      expect(donorReview.openInTransaction).toHaveBeenCalled();
    });

    it('opens no review for a CLEAR result', async () => {
      await record();

      expect(donorReview.openInTransaction).not.toHaveBeenCalled();
    });

    it('refuses a requirement the order\'s pinned policy version does not list', async () => {
      await expect(record({ requirementCode: 'REQ-NOT-IN-POLICY' })).rejects.toMatchObject({
        response: { code: ScreeningReason.REQUIREMENT_NOT_IN_POLICY },
      });
    });

    it('refuses a rejected sample', async () => {
      prisma.donationSample.findFirst.mockResolvedValue({
        id: 'sample-1',
        donationId: 'donation-1',
        status: 'REJECTED',
      });

      await expect(record({ sampleId: 'sample-1' })).rejects.toMatchObject({
        response: { code: ScreeningReason.SAMPLE_UNUSABLE },
      });
    });

    it('refuses a sample drawn from a different donation', async () => {
      prisma.donationSample.findFirst.mockResolvedValue({
        id: 'sample-1',
        donationId: 'some-other-donation',
        status: 'RECEIVED',
      });

      await expect(record({ sampleId: 'sample-1' })).rejects.toMatchObject({
        response: { code: ScreeningReason.SAMPLE_UNUSABLE },
      });
    });

    it('refuses to add results to a cancelled order', async () => {
      prisma.screeningOrder.findFirst.mockResolvedValue(
        order({ status: ScreeningOrderStatus.CANCELLED }),
      );

      await expect(record()).rejects.toMatchObject({
        response: { code: ScreeningReason.ORDER_NOT_OPEN },
      });
    });

    it('keeps the confidential comment out of the audit log', async () => {
      await record({ confidentialComment: 'CONFIDENTIAL-MARKER bench note' });

      expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain('CONFIDENTIAL-MARKER');
    });
  });

  describe('entering a result is not reviewing it', () => {
    beforeEach(() => {
      prisma.screeningResult.findFirst.mockResolvedValue({
        id: 'result-1',
        performedBy: 'tech-1',
        reviewedAt: null,
        superseded: false,
        requirementCode: 'REQ-A',
        disposition: SafetyDisposition.CLEAR,
        screeningOrderId: ORDER,
      });
    });

    it('refuses the person who recorded it, whatever roles they hold', async () => {
      await expect(
        service.reviewResult(ORG, 'result-1', 'tech-1', {}),
      ).rejects.toMatchObject({
        response: { code: ScreeningReason.REVIEWER_IS_PERFORMER },
      });
    });

    it('permits a different person', async () => {
      await expect(service.reviewResult(ORG, 'result-1', 'tech-2', {})).resolves.toBeDefined();
    });

    it('refuses a result that has already been reviewed', async () => {
      prisma.screeningResult.findFirst.mockResolvedValue({
        id: 'result-1',
        performedBy: 'tech-1',
        reviewedAt: new Date(),
        superseded: false,
        requirementCode: 'REQ-A',
        disposition: SafetyDisposition.CLEAR,
        screeningOrderId: ORDER,
      });

      await expect(service.reviewResult(ORG, 'result-1', 'tech-2', {})).rejects.toMatchObject({
        response: { code: ScreeningReason.RESULT_ALREADY_REVIEWED },
      });
    });

    it('refuses a superseded result, because the correction is what matters now', async () => {
      prisma.screeningResult.findFirst.mockResolvedValue({
        id: 'result-1',
        performedBy: 'tech-1',
        reviewedAt: null,
        superseded: true,
        requirementCode: 'REQ-A',
        disposition: SafetyDisposition.CLEAR,
        screeningOrderId: ORDER,
      });

      await expect(service.reviewResult(ORG, 'result-1', 'tech-2', {})).rejects.toMatchObject({
        response: { code: ScreeningReason.RESULT_SUPERSEDED },
      });
    });

    it('refuses an account with no clinical role at the organization', async () => {
      const module = await Test.createTestingModule({
        providers: [
          ScreeningResultsService,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditLogsService, useValue: audit },
          {
            provide: ScreeningOrdersService,
            useValue: {
              assertScreeningStaffFor: jest
                .fn()
                .mockRejectedValue(new ForbiddenException('not a clinical reviewer')),
            },
          },
          { provide: DonorReviewService, useValue: donorReview },
          { provide: RecallService, useValue: recall },
        ],
      }).compile();

      await expect(
        module.get(ScreeningResultsService).reviewResult(ORG, 'result-1', 'admin-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('correcting a result', () => {
    function original(overrides: Record<string, any> = {}) {
      return {
        id: 'result-1',
        requirementId: 'req-1',
        requirementCode: 'REQ-A',
        sampleId: null,
        resultCode: 'CODE-PASS',
        disposition: SafetyDisposition.CLEAR,
        superseded: false,
        source: 'MANUAL',
        methodReference: null,
        reagentReference: null,
        reagentLot: 'LOT-77',
        reagentExpiresAt: null,
        analyzerReference: null,
        receivedAt: null,
        screeningOrder: order({
          policy: policy([
            { resultCode: 'CODE-PASS', disposition: SafetyDisposition.CLEAR },
            { resultCode: 'CODE-BLOCK', disposition: SafetyDisposition.BLOCK },
          ]),
        }),
        ...overrides,
      };
    }

    const correct = (input: Record<string, any> = {}) =>
      service.correctResult(ORG, 'result-1', 'tech-2', {
        resultCode: 'CODE-BLOCK',
        reason: 'Transcription error at the bench.',
        ...input,
      } as any);

    beforeEach(() => {
      prisma.screeningResult.findFirst.mockResolvedValue(original());
    });

    it('supersedes rather than overwrites, and records what changed', async () => {
      await correct();

      expect(tx.screeningResult.updateMany).toHaveBeenCalledWith({
        where: { id: 'result-1', superseded: false },
        data: expect.objectContaining({ superseded: true }),
      });
      expect(tx.screeningResult.create).toHaveBeenCalled();
      expect(tx.screeningResultRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalResultId: 'result-1',
            originalResultCode: 'CODE-PASS',
            correctedResultCode: 'CODE-BLOCK',
            originalDisposition: SafetyDisposition.CLEAR,
            correctedDisposition: SafetyDisposition.BLOCK,
            reason: 'Transcription error at the bench.',
            correctedBy: 'tech-2',
          }),
        }),
      );
    });

    it('does not carry the original review forward onto the corrected value', async () => {
      await correct();

      const data = tx.screeningResult.create.mock.calls[0][0].data;
      expect(data.reviewedBy).toBeUndefined();
      expect(data.reviewedAt).toBeUndefined();
    });

    it('opens a recall when the meaning worsens and a component is already released', async () => {
      prisma.bloodUnit.count.mockResolvedValue(2);

      const result = await correct();

      expect(recall.openForDonationInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          donationId: 'donation-1',
          triggerKind: RecallTrigger.SCREENING_RESULT_CORRECTED,
        }),
      );
      expect(result.data.recallOpened).toBe(true);
      expect(result.data.releasedComponentsAtCorrection).toBe(2);
    });

    it('opens the recall in the same transaction as the correction', async () => {
      prisma.bloodUnit.count.mockResolvedValue(1);

      await correct();

      // The transaction client, not the service's own. A correction that
      // commits while its recall is rolled back would leave the system
      // believing the new result with nobody told.
      expect(recall.openForDonationInTransaction.mock.calls[0][0]).toBe(tx);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('announces the recall only after the transaction has committed', async () => {
      prisma.bloodUnit.count.mockResolvedValue(1);
      const order: string[] = [];
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const result = await cb(tx);
        order.push('commit');
        return result;
      });
      recall.announce.mockImplementation(() => order.push('announce'));

      await correct();

      expect(order).toEqual(['commit', 'announce']);
    });

    it('announces nothing when no recall was opened', async () => {
      prisma.bloodUnit.count.mockResolvedValue(0);

      await correct();

      expect(recall.announce).not.toHaveBeenCalled();
    });

    it('opens no recall when nothing has been released yet', async () => {
      prisma.bloodUnit.count.mockResolvedValue(0);

      const result = await correct();

      expect(recall.openForDonationInTransaction).not.toHaveBeenCalled();
      // Reported rather than left to be inferred: an operator must be able to
      // see that no recall was opened and why.
      expect(result.data.recallOpened).toBe(false);
      expect(result.data.releasedComponentsAtCorrection).toBe(0);
    });

    it('opens no recall when the correction makes the meaning better', async () => {
      prisma.bloodUnit.count.mockResolvedValue(3);
      prisma.screeningResult.findFirst.mockResolvedValue(
        original({ resultCode: 'CODE-BLOCK', disposition: SafetyDisposition.BLOCK }),
      );

      const result = await correct({ resultCode: 'CODE-PASS' });

      // It cannot make blood that has already gone out less safe.
      expect(recall.openForDonationInTransaction).not.toHaveBeenCalled();
      expect(result.data.recallOpened).toBe(false);
    });

    it('links the revision to the recall it opened', async () => {
      prisma.bloodUnit.count.mockResolvedValue(1);

      await correct();

      expect(tx.screeningResultRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recallCaseId: 'case-1' }) }),
      );
    });

    it('opens a medical review when the corrected meaning calls for one', async () => {
      await correct();

      expect(donorReview.openInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ triggerDisposition: SafetyDisposition.BLOCK }),
      );
    });

    it('refuses a correction that changes nothing', async () => {
      await expect(correct({ resultCode: 'code-pass' })).rejects.toMatchObject({
        response: { code: ScreeningReason.CORRECTION_IS_NOT_A_CHANGE },
      });
    });

    it('refuses to correct a result that has already been superseded', async () => {
      prisma.screeningResult.findFirst.mockResolvedValue(original({ superseded: true }));

      await expect(correct()).rejects.toMatchObject({
        response: { code: ScreeningReason.RESULT_SUPERSEDED },
      });
    });

    it('refuses the loser of two concurrent corrections', async () => {
      tx.screeningResult.updateMany.mockResolvedValue({ count: 0 });

      await expect(correct()).rejects.toThrow(ConflictException);
    });

    it('keeps the confidential comment out of the audit log', async () => {
      await correct({ confidentialComment: 'CONFIDENTIAL-MARKER clinical note' });

      const logged = JSON.stringify(
        audit.log.mock.calls.find((call) => call[0].action === 'SCREENING_RESULT_CORRECTED'),
      );
      expect(logged).not.toContain('CONFIDENTIAL-MARKER');
      expect(logged).toContain('originalResultCode');
    });
  });
});
