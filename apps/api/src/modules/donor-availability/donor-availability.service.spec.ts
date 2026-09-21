import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { DonorDeferralsService } from '../donor-deferrals/donor-deferrals.service';
import { DonorReviewService } from '../donor-review/donor-review.service';
import {
  DonorAvailabilityReason,
  DonorAvailabilityService,
} from './donor-availability.service';

/**
 * The canonical guard.
 *
 * Three rules could stop a donation and before Sprint 10 each caller assembled
 * its own subset of them: booking checked two, check-in checked the same two in
 * a different order, emergency matching checked a profile column plus one. The
 * point of this suite is that there is now one answer, that it refuses for each
 * of the three reasons independently, and that the refusal a donor's own phone
 * receives says nothing clinical.
 */
describe('DonorAvailabilityService', () => {
  let service: DonorAvailabilityService;
  let eligibility: {
    assertEligibleToDonateAt: jest.Mock;
    isEligibleToDonateAt: jest.Mock;
    isEligibleAt: jest.Mock;
    getNextEligibleDonationDates: jest.Mock;
  };
  let deferrals: {
    assertNotDeferredAt: jest.Mock;
    isDeferredAt: jest.Mock;
    findDeferredDonorIds: jest.Mock;
  };
  let review: { isUnderReview: jest.Mock; findDonorsUnderReview: jest.Mock };

  const WHEN = new Date('2026-09-21T09:00:00.000Z');

  beforeEach(async () => {
    eligibility = {
      assertEligibleToDonateAt: jest.fn().mockResolvedValue(undefined),
      isEligibleToDonateAt: jest.fn().mockResolvedValue(true),
      isEligibleAt: jest.fn(
        (date: Date | null | undefined, when: Date) => !date || date.getTime() <= when.getTime(),
      ),
      getNextEligibleDonationDates: jest.fn().mockResolvedValue(new Map<string, Date>()),
    };
    deferrals = {
      assertNotDeferredAt: jest.fn().mockResolvedValue(undefined),
      isDeferredAt: jest.fn().mockResolvedValue(false),
      findDeferredDonorIds: jest.fn().mockResolvedValue(new Set<string>()),
    };
    review = {
      isUnderReview: jest.fn().mockResolvedValue(false),
      findDonorsUnderReview: jest.fn().mockResolvedValue(new Set<string>()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorAvailabilityService,
        { provide: DonationEligibilityService, useValue: eligibility },
        { provide: DonorDeferralsService, useValue: deferrals },
        { provide: DonorReviewService, useValue: review },
      ],
    }).compile();

    service = module.get(DonorAvailabilityService);
  });

  describe('assertAvailableAt', () => {
    it('permits a donor with nothing standing against them', async () => {
      await expect(service.assertAvailableAt('donor-1', WHEN)).resolves.toBeUndefined();
    });

    it('refuses a donor under medical review', async () => {
      review.isUnderReview.mockResolvedValue(true);

      await expect(service.assertAvailableAt('donor-1', WHEN)).rejects.toMatchObject({
        response: { code: DonorAvailabilityReason.MEDICAL_REVIEW_REQUIRED },
      });
    });

    it('asks about medical review before it asks anything else, and stops there', async () => {
      // Not a performance detail. The refusal a client shows should be the one
      // that actually needs a conversation with staff, not the one a donor can
      // work out from a calendar.
      review.isUnderReview.mockResolvedValue(true);

      await expect(service.assertAvailableAt('donor-1', WHEN)).rejects.toThrow(ConflictException);

      expect(deferrals.assertNotDeferredAt).not.toHaveBeenCalled();
      expect(eligibility.assertEligibleToDonateAt).not.toHaveBeenCalled();
    });

    it('carries no clinical detail in the medical-review refusal', async () => {
      // This refusal is read by the donor's own phone. No disposition, no
      // screening reference, no organisation, no count of how many reviews
      // stand: every one of those is a hint about a clinical finding.
      review.isUnderReview.mockResolvedValue(true);

      const error = await service.assertAvailableAt('donor-1', WHEN).catch((e) => e);
      const response = error.getResponse();

      // Two keys, and no third one for somebody to put details in later.
      expect(Object.keys(response)).toEqual(['code', 'message']);
      // The code is fixed and says only that a review is required.
      expect(response.code).toBe(DonorAvailabilityReason.MEDICAL_REVIEW_REQUIRED);
      // The prose names nothing clinical at all.
      expect(response.message).not.toMatch(
        /BLOCK|REVIEW_REQUIRED|disposition|screening|result|reactive|positive|negative|infect/i,
      );
    });

    it('still refuses a deferred donor, with the code clients already branch on', async () => {
      deferrals.assertNotDeferredAt.mockRejectedValue(
        new ConflictException({ code: DonorAvailabilityReason.DEFERRED }),
      );

      await expect(service.assertAvailableAt('donor-1', WHEN)).rejects.toMatchObject({
        response: { code: DonorAvailabilityReason.DEFERRED },
      });
    });

    it('still refuses a donor inside their recovery window', async () => {
      eligibility.assertEligibleToDonateAt.mockRejectedValue(
        new ConflictException({ code: DonorAvailabilityReason.RECOVERY_WINDOW }),
      );

      await expect(service.assertAvailableAt('donor-1', WHEN)).rejects.toMatchObject({
        response: { code: DonorAvailabilityReason.RECOVERY_WINDOW },
      });
    });

    it('passes the caller\'s moment to the rules that are a function of time', async () => {
      await service.assertAvailableAt('donor-1', WHEN);

      expect(deferrals.assertNotDeferredAt).toHaveBeenCalledWith('donor-1', WHEN);
      expect(eligibility.assertEligibleToDonateAt).toHaveBeenCalledWith('donor-1', WHEN);
    });

    it('does not pass a moment to medical review, because a review has no end', async () => {
      // A review stands until a clinician resolves it. There is no future
      // moment at which it can be assumed lifted, so a donor under review
      // cannot book for next month on the assumption somebody will have looked.
      await service.assertAvailableAt('donor-1', WHEN);

      expect(review.isUnderReview).toHaveBeenCalledWith('donor-1');
      expect(review.isUnderReview.mock.calls[0]).toHaveLength(1);
    });
  });

  describe('checkAvailableAt', () => {
    it('names the reason rather than throwing', async () => {
      review.isUnderReview.mockResolvedValue(true);

      expect(await service.checkAvailableAt('donor-1', WHEN)).toEqual({
        available: false,
        reasonCode: DonorAvailabilityReason.MEDICAL_REVIEW_REQUIRED,
      });
    });

    it('reports availability when nothing stands', async () => {
      expect(await service.checkAvailableAt('donor-1', WHEN)).toEqual({
        available: true,
        reasonCode: null,
      });
    });

    it('reports a deferral and a recovery window as their own reasons', async () => {
      deferrals.isDeferredAt.mockResolvedValue(true);
      expect((await service.checkAvailableAt('donor-1', WHEN)).reasonCode).toBe(
        DonorAvailabilityReason.DEFERRED,
      );

      deferrals.isDeferredAt.mockResolvedValue(false);
      eligibility.isEligibleToDonateAt.mockResolvedValue(false);
      expect((await service.checkAvailableAt('donor-1', WHEN)).reasonCode).toBe(
        DonorAvailabilityReason.RECOVERY_WINDOW,
      );
    });
  });

  describe('findUnavailableDonorIds', () => {
    it('returns an empty set for an empty candidate list, without asking anything', async () => {
      expect(await service.findUnavailableDonorIds([], WHEN)).toEqual(new Set());
      expect(review.findDonorsUnderReview).not.toHaveBeenCalled();
    });

    it('excludes a donor under medical review', async () => {
      review.findDonorsUnderReview.mockResolvedValue(new Set(['donor-2']));

      const unavailable = await service.findUnavailableDonorIds(['donor-1', 'donor-2'], WHEN);

      expect(unavailable.has('donor-2')).toBe(true);
      expect(unavailable.has('donor-1')).toBe(false);
    });

    it('excludes for all three reasons at once, and unions them', async () => {
      review.findDonorsUnderReview.mockResolvedValue(new Set(['under-review']));
      deferrals.findDeferredDonorIds.mockResolvedValue(new Set(['deferred']));
      eligibility.getNextEligibleDonationDates.mockResolvedValue(
        new Map([['recovering', new Date(WHEN.getTime() + 7 * 24 * 60 * 60 * 1000)]]),
      );

      const unavailable = await service.findUnavailableDonorIds(
        ['under-review', 'deferred', 'recovering', 'available'],
        WHEN,
      );

      expect([...unavailable].sort()).toEqual(['deferred', 'recovering', 'under-review']);
    });

    it('asks each rule once for the whole set, not once per donor', async () => {
      // The set-based shape is what makes using the canonical guard inside
      // emergency matching affordable. Without it the tempting shortcut is a
      // status filter in the SQL, which is the duplicated check this service
      // exists to prevent.
      await service.findUnavailableDonorIds(['a', 'b', 'c', 'd', 'e'], WHEN);

      expect(review.findDonorsUnderReview).toHaveBeenCalledTimes(1);
      expect(deferrals.findDeferredDonorIds).toHaveBeenCalledTimes(1);
      expect(eligibility.getNextEligibleDonationDates).toHaveBeenCalledTimes(1);
    });
  });
});
