import { Global, Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RecallController, TraceabilityController } from './recall.controller';
import { RecallService } from './recall.service';

/**
 * Global because a correction to a screening result opens a recall, and a
 * hemovigilance report can link to one. Both of those live elsewhere.
 */
@Global()
@Module({
  imports: [AuditLogsModule],
  controllers: [RecallController, TraceabilityController],
  providers: [RecallService],
  exports: [RecallService],
})
export class RecallModule {}
