import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DonationEligibilityService } from './donation-eligibility.service';

@Module({
  imports: [DatabaseModule],
  providers: [DonationEligibilityService],
  exports: [DonationEligibilityService],
})
export class DonationEligibilityModule {}
