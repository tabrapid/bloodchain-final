import { Global, Module } from '@nestjs/common';
import { ClinicalReleaseService } from './clinical-release.service';

/**
 * Global because the gate has to be reachable from every path that could move a
 * unit onward -- inventory, shipments, blood requests -- and a safety check
 * that some modules can reach and others cannot is not a safety check.
 */
@Global()
@Module({
  providers: [ClinicalReleaseService],
  exports: [ClinicalReleaseService],
})
export class ClinicalReleaseModule {}
