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

// The mobile app is the only consumer of `deepLink` (push-notification taps
// and the in-app notification list both call `router.push(deepLink)`
// directly). A deepLink that doesn't match a real mobile route silently
// fails to navigate, so every value emitted here is pinned against the
// actual route it must resolve to in apps/mobile/app.
describe('NotificationRouterService deepLinks (must resolve to a real mobile route)', () => {
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

  async function deepLinkOf(fn: () => Promise<unknown>): Promise<string> {
    await fn();
    const call = notificationsService.create.mock.calls[notificationsService.create.mock.calls.length - 1][0];
    return call.deepLink;
  }

  it('routes SOS notifications to /sos (sos.tsx has no per-request detail route)', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeSosNotification({ id: 'sos-1', bloodType: 'O_NEG' }, ['donor-1']),
    );
    expect(deepLink).toBe('/sos');
  });

  it('routes donation confirmations to the real donation detail route', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeDonationConfirmation({ id: 'don-1' }, 'donor-1'),
    );
    expect(deepLink).toBe('/(app)/donations/don-1');
  });

  it('routes appointment notifications to /(app)/appointment/:id, not the nonexistent /calendar/appointment/:id', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeAppointmentNotification({ id: 'appt-1', scheduledAt: new Date() }, ['donor-1'], 'created'),
    );
    expect(deepLink).toBe('/(app)/appointment/appt-1');
  });

  it('routes lab result notifications to the laboratory list (no per-result detail screen exists)', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeLabResultNotification({ id: 'lab-1' }, 'donor-1'),
    );
    expect(deepLink).toBe('/(app)/laboratory');
  });

  it('routes achievement notifications to the achievements list (no per-achievement detail screen exists)', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeAchievementNotification({ id: 'ach-1', name: 'First Donation' }, 'donor-1'),
    );
    expect(deepLink).toBe('/(app)/gamification/achievements');
  });

  it('routes level-up notifications to the fully-qualified donor profile (bare /profile collides with (courier)/profile)', async () => {
    const deepLink = await deepLinkOf(() => service.routeLevelUpNotification('donor-1', 3));
    expect(deepLink).toBe('/(app)/profile');
  });

  it('routes shipment notifications to the courier active-deliveries list (no per-shipment detail screen exists)', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeShipmentNotification({ id: 'shp-1' }, ['courier-1'], 'courier_assigned'),
    );
    expect(deepLink).toBe('/(courier)/active');
  });

  it('routes inventory alerts to home (the mobile app has no inventory screen)', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeInventoryAlert({ id: 'inv-1', bloodType: 'O_NEG' }, ['staff-1'], 'CRITICAL'),
    );
    expect(deepLink).toBe('/(app)/home');
  });

  it('routes security notifications to /(app)/security, not the nonexistent /profile/security', async () => {
    const deepLink = await deepLinkOf(() =>
      service.routeSecurityNotification('donor-1', 'PASSWORD_CHANGED', 'Your password was changed'),
    );
    expect(deepLink).toBe('/(app)/security');
  });
});
