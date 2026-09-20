import { Global, Module } from '@nestjs/common';
import { CustodyLedgerService } from './custody-ledger.service';

/**
 * Global for the same reason ClinicalReleaseModule is: every path that can move
 * a unit has to be able to record that it did. A ledger some modules can write
 * to and others cannot is not a chain of custody.
 */
@Global()
@Module({
  providers: [CustodyLedgerService],
  exports: [CustodyLedgerService],
})
export class CustodyModule {}
