import { Module } from '@nestjs/common';
import { InventoryController, BloodAvailabilityController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCronService } from './inventory-cron.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [IdempotencyModule],
  controllers: [InventoryController, BloodAvailabilityController],
  providers: [InventoryService, InventoryCronService],
  exports: [InventoryService],
})
export class InventoryModule {}