import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { PushDeviceService } from './services/push-device.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationRouterService } from './services/notification-router.service';
import { NotificationEventHandler } from './handlers/notification-event.handler';

@Module({
  imports: [EventEmitterModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeviceService,
    NotificationPreferenceService,
    NotificationDeliveryService,
    NotificationRouterService,
    NotificationEventHandler,
  ],
  exports: [
    NotificationsService,
    NotificationRouterService,
    NotificationPreferenceService,
    PushDeviceService,
  ],
})
export class NotificationsModule {}
