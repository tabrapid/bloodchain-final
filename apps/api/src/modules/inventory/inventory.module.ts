import { Module } from '@nestjs/common';
import { InventoryController, BloodAvailabilityController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController, BloodAvailabilityController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}