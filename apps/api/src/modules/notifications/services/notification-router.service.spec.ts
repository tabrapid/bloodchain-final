import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationRouterService } from './notification-router.service';

describe('NotificationRouterService.routeShipmentNotification', () => {
  let service: NotificationRouterService;
  let notificationsService: { create: jest.Mock };

  beforeEach(async () => {
    notificationsService = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRouterService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<NotificationRouterService>(NotificationRouterService);
  });

  it.each([
    ['courier_assigned', "You've been assigned a new blood shipment delivery"],
    ['accepted', 'The assigned courier has accepted this shipment'],
    ['declined', 'The assigned courier declined this shipment - it needs to be reassigned'],
    ['picked_up', 'Courier has picked up the shipment'],
    ['in_transit', 'Your shipment is on the way'],
    ['arrived', 'Shipment has arrived at its destination'],
    ['delivered', 'Shipment has been delivered successfully'],
    ['failed', 'Shipment delivery failed. Please contact support.'],
  ])('sends the real "%s" template, not the generic "Shipment Created" fallback', async (event, expectedBody) => {
    await service.routeShipmentNotification({ id: 'shp-1' }, ['user-1'], event);

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expectedBody }),
    );
    expect(notificationsService.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ body: 'A new blood shipment has been created' }),
    );
  });

  it('falls back to the created template only for a genuinely unknown event key', async () => {
    await service.routeShipmentNotification({ id: 'shp-1' }, ['user-1'], 'some_future_event');

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Shipment Created', body: 'A new blood shipment has been created' }),
    );
  });

  it('sends a HIGH priority notification for both failed and declined', async () => {
    await service.routeShipmentNotification({ id: 'shp-1' }, ['user-1'], 'declined');
    expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'HIGH' }));

    await service.routeShipmentNotification({ id: 'shp-1' }, ['user-1'], 'failed');
    expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'HIGH' }));
  });
});
