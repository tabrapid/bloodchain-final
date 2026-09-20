import { Global, Module } from '@nestjs/common';
import { InventoryThresholdsController } from './inventory-thresholds.controller';
import { InventoryThresholdsService } from './inventory-thresholds.service';

@Global()
@Module({
  controllers: [InventoryThresholdsController],
  providers: [InventoryThresholdsService],
  exports: [InventoryThresholdsService],
})
export class InventoryThresholdsModule {}
