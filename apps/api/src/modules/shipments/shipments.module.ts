import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentStateMachine } from './services/shipment-state.service';
import { LocationService } from './services/location.service';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ShipmentGateway } from '../../gateways/shipment.gateway';

@Module({
  imports: [DatabaseModule, NotificationsModule, IdempotencyModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentStateMachine, LocationService, ShipmentGateway],
  exports: [ShipmentsService, ShipmentStateMachine, LocationService],
})
export class ShipmentsModule {}
