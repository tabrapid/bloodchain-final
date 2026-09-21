import { Global, Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ConsentService } from './consent.service';

/**
 * Global, because a consent gate that only some modules can reach is not a
 * consent gate. Emergency matching, live location, notifications and the AI
 * module all have to be able to ask.
 */
@Global()
@Module({
  imports: [AuditLogsModule],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
