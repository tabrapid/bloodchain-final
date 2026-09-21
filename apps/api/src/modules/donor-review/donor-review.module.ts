import { Global, Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DonorDeferralsModule } from '../donor-deferrals/donor-deferrals.module';
import { DonorReviewController, DonorReviewSelfController } from './donor-review.controller';
import { DonorReviewService } from './donor-review.service';

/**
 * Global because screening raises reviews, the availability guard reads them,
 * and the donor's own profile endpoint reports the one bit a donor may see.
 */
@Global()
@Module({
  imports: [AuditLogsModule, DonorDeferralsModule],
  controllers: [DonorReviewController, DonorReviewSelfController],
  providers: [DonorReviewService],
  exports: [DonorReviewService],
})
export class DonorReviewModule {}
