import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentStateMachine } from './services/shipment-state.service';
import { LocationService } from './services/location.service';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentStateMachine, LocationService],
  exports: [ShipmentsService, ShipmentStateMachine, LocationService],
})
export class ShipmentsModule {}
