import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DonationsController, OrganizationDonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [EventEmitterModule],
  controllers: [DonationsController, OrganizationDonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}