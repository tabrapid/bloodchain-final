import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [AuditLogsModule, IdempotencyModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}