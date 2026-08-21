import { Module } from '@nestjs/common';
import { DonationsController, OrganizationDonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  controllers: [DonationsController, OrganizationDonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}