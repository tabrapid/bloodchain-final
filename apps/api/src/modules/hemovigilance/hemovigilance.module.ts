import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { HemovigilanceController } from './hemovigilance.controller';
import { HemovigilanceService } from './hemovigilance.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [HemovigilanceController],
  providers: [HemovigilanceService],
  exports: [HemovigilanceService],
})
export class HemovigilanceModule {}
