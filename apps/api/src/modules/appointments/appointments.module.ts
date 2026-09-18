import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentExpiryService } from './appointment-expiry.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { DonationEligibilityModule } from '../donation-eligibility/donation-eligibility.module';

@Module({
  imports: [AuditLogsModule, IdempotencyModule, DonationEligibilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentReminderService, AppointmentExpiryService],
  exports: [AppointmentsService, AppointmentExpiryService],
})
export class AppointmentsModule {}