import { Module } from '@nestjs/common';
import { AppointmentSlotsController } from './appointment-slots.controller';
import { AppointmentSlotsService } from './appointment-slots.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [AppointmentSlotsController],
  providers: [AppointmentSlotsService],
  exports: [AppointmentSlotsService],
})
export class AppointmentSlotsModule {}