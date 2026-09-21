import { Global, Module } from '@nestjs/common';

import { DonationEligibilityModule } from '../donation-eligibility/donation-eligibility.module';
import { DonorDeferralsModule } from '../donor-deferrals/donor-deferrals.module';
import { DonorReviewModule } from '../donor-review/donor-review.module';
import { DonorAvailabilityService } from './donor-availability.service';

/**
 * Global for the same reason the clinical release gate is: every path that can
 * put a needle in a donor's arm has to be able to ask whether it may, and a
 * safety check some modules can reach and others cannot is not a safety check.
 */
@Global()
@Module({
  imports: [DonationEligibilityModule, DonorDeferralsModule, DonorReviewModule],
  providers: [DonorAvailabilityService],
  exports: [DonorAvailabilityService],
})
export class DonorAvailabilityModule {}
