import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { PushDeviceService } from './services/push-device.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { PushProviderService } from './services/push-provider.service';
import { NotificationRouterService } from './services/notification-router.service';
import { NotificationEventHandler } from './handlers/notification-event.handler';

@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeviceService,
    NotificationPreferenceService,
    NotificationDeliveryService,
    PushProviderService,
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
