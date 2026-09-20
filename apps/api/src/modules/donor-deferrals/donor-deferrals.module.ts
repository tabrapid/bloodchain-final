import { Global, Module } from '@nestjs/common';
import { DonorDeferralsController, DonorDeferralsSelfController } from './donor-deferrals.controller';
import { DonorDeferralsService } from './donor-deferrals.service';

/**
 * Global for the same reason as the release gate: booking, check-in and
 * emergency matching all have to be able to ask "is this donor deferred", and
 * the answer must come from one place.
 */
@Global()
@Module({
  controllers: [DonorDeferralsController, DonorDeferralsSelfController],
  providers: [DonorDeferralsService],
  exports: [DonorDeferralsService],
})
export class DonorDeferralsModule {}
