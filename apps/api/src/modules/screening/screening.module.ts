import { Global, Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RecallModule } from '../recall/recall.module';
import { ScreeningController } from './screening.controller';
import { ScreeningOrdersService } from './screening-orders.service';
import { ScreeningResultsService } from './screening-results.service';

/**
 * Global because donation completion raises a screening order, and donations
 * are not a screening concern the other way round. A module some paths can
 * reach and others cannot would mean donations completed at one door produced
 * an order and donations completed at another did not.
 */
@Global()
@Module({
  imports: [AuditLogsModule, RecallModule],
  controllers: [ScreeningController],
  providers: [ScreeningOrdersService, ScreeningResultsService],
  exports: [ScreeningOrdersService, ScreeningResultsService],
})
export class ScreeningModule {}
