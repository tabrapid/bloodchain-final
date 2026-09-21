import { ConflictException, Injectable } from '@nestjs/common';

import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { DonorDeferralsService } from '../donor-deferrals/donor-deferrals.service';
import {
  DONOR_REVIEW_DONOR_MESSAGE_KEY,
  DonorReviewService,
} from '../donor-review/donor-review.service';

/** Why a donor may not donate at a given moment. */
export const DonorAvailabilityReason = {
  RECOVERY_WINDOW: 'DONOR_IN_RECOVERY_WINDOW',
  DEFERRED: 'DONOR_DEFERRED',
  MEDICAL_REVIEW_REQUIRED: 'DONOR_MEDICAL_REVIEW_REQUIRED',
} as const;

export type DonorAvailabilityReasonCode =
  (typeof DonorAvailabilityReason)[keyof typeof DonorAvailabilityReason];

export interface DonorAvailability {
  available: boolean;
  reasonCode: DonorAvailabilityReasonCode | null;
}

/**
 * The one answer to "may this donor donate at this moment".
 *
 * Three separate rules could stop a donation -- a recovery window, a deferral,
 * a medical review -- and before this service each caller assembled its own
 * subset of them. Booking checked two, check-in checked the same two in a
 * different order, and emergency matching checked a profile column plus one of
 * them. Adding `MEDICAL_REVIEW_REQUIRED` to three independent checks would have
 * meant three chances to forget it, and the Product Owner's instruction was
 * explicit: one canonical guard, not three unrelated checks.
 *
 * So every gate calls `assertAvailableAt` and gets the same answer. Adding a
 * fourth rule later means editing one method.
 *
 * ## The moment is a parameter
 *
 * Kept from the services this composes, and for the same reason: booking asks
 * about the slot's start time (a donor three days from the end of their
 * recovery window may legitimately book a slot next week), while check-in and
 * emergency matching ask about now. Answering all three against `now` would
 * refuse valid future bookings.
 *
 * Medical review is the exception within that, and deliberately. A review is a
 * hold that stands until a clinician resolves it, with no scheduled end, so
 * there is no future moment at which it can be assumed lifted. A donor under
 * review cannot book a slot for next month on the assumption somebody will have
 * looked by then.
 *
 * ## Order
 *
 * Medical review is asked first, then the deferral, then the recovery window.
 * The order is not arbitrary: it runs from the answer that is hardest to
 * predict to the one a donor can work out from a calendar, so the refusal a
 * client shows is the one that actually needs a conversation with staff.
 */
@Injectable()
export class DonorAvailabilityService {
  constructor(
    private readonly donationEligibility: DonationEligibilityService,
    private readonly deferrals: DonorDeferralsService,
    private readonly review: DonorReviewService,
  ) {}

  /**
   * Refuse when anything stands between this donor and a donation at `when`.
   *
   * Throws the same shapes the individual services threw before, so every
   * existing client keeps working: `DONOR_IN_RECOVERY_WINDOW` and
   * `DONOR_DEFERRED` are unchanged, and `DONOR_MEDICAL_REVIEW_REQUIRED` is the
   * one new code.
   *
   * The medical-review refusal carries a code and a plain sentence and nothing
   * else. Not the disposition that raised it, not the screening order, not how
   * many reviews stand, not which organization raised them: this refusal is
   * read by the donor's own phone.
   */
  async assertAvailableAt(donorId: string, when: Date): Promise<void> {
    if (await this.review.isUnderReview(donorId)) {
      throw new ConflictException({
        code: DonorAvailabilityReason.MEDICAL_REVIEW_REQUIRED,
        /**
         * A catalogue key, so a client can say this in the donor's own
         * language rather than rendering the English below.
         *
         * The sentence used to be written in the third person -- "before THIS
         * DONOR can give blood again" -- which is staff wording, and this
         * refusal is read by the donor's own phone. It is second person now and
         * matches the catalogue sentence word for word, so the translated and
         * untranslated paths say the same thing.
         */
        messageKey: DONOR_REVIEW_DONOR_MESSAGE_KEY,
        message:
          'Medical review is required before your next donation. Staff at the blood centre can help.',
      });
    }

    await this.deferrals.assertNotDeferredAt(donorId, when);
    await this.donationEligibility.assertEligibleToDonateAt(donorId, when);
  }

  /** The same question without the exception, for screens that explain rather than refuse. */
  async checkAvailableAt(donorId: string, when: Date): Promise<DonorAvailability> {
    if (await this.review.isUnderReview(donorId)) {
      return { available: false, reasonCode: DonorAvailabilityReason.MEDICAL_REVIEW_REQUIRED };
    }

    if (await this.deferrals.isDeferredAt(donorId, when)) {
      return { available: false, reasonCode: DonorAvailabilityReason.DEFERRED };
    }

    if (!(await this.donationEligibility.isEligibleToDonateAt(donorId, when))) {
      return { available: false, reasonCode: DonorAvailabilityReason.RECOVERY_WINDOW };
    }

    return { available: true, reasonCode: null };
  }

  /**
   * Donors who may NOT donate at `when`, from a candidate list, in three
   * queries rather than three per donor.
   *
   * Emergency matching needs this for every candidate it is about to alert, and
   * asking per donor would put a query per donor inside the matching path. The
   * set-based shape is what makes using the canonical guard there affordable --
   * without it the tempting shortcut is a `donorStatus` filter in the SQL,
   * which is exactly the duplicated check this service exists to prevent.
   */
  async findUnavailableDonorIds(donorIds: string[], when: Date): Promise<Set<string>> {
    if (donorIds.length === 0) return new Set();

    const [underReview, deferred, eligibleFrom] = await Promise.all([
      this.review.findDonorsUnderReview(donorIds),
      this.deferrals.findDeferredDonorIds(donorIds, when),
      this.donationEligibility.getNextEligibleDonationDates(donorIds),
    ]);

    const unavailable = new Set<string>([...underReview, ...deferred]);

    for (const donorId of donorIds) {
      if (!this.donationEligibility.isEligibleAt(eligibleFrom.get(donorId) ?? null, when)) {
        unavailable.add(donorId);
      }
    }

    return unavailable;
  }
}
