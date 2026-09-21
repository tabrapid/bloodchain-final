import { Global, Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ColdChainService } from './cold-chain.service';
import { CustodyLedgerService } from './custody-ledger.service';
import { HoldsService } from './holds.service';

/**
 * Global for the same reason ClinicalReleaseModule is: every path that can move
 * a unit has to be able to record that it did, and every path that can put one
 * into stock has to be able to see what stands against it. A ledger some
 * modules can write to and others cannot is not a chain of custody.
 */
@Global()
@Module({
  imports: [AuditLogsModule],
  providers: [CustodyLedgerService, HoldsService, ColdChainService],
  exports: [CustodyLedgerService, HoldsService, ColdChainService],
})
export class CustodyModule {}
