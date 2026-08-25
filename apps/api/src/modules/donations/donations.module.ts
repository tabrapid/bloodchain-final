import { Module } from '@nestjs/common';
import { DonationsController, OrganizationDonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [IdempotencyModule],
  controllers: [DonationsController, OrganizationDonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}