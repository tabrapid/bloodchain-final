import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushTicket } from 'expo-server-sdk';
import { PushProviderService } from './push-provider.service';

describe('PushProviderService', () => {
  let service: PushProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushProviderService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get<PushProviderService>(PushProviderService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isValidToken', () => {
    it('accepts a well-formed Expo push token', () => {
      expect(service.isValidToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    });

    it('rejects a non-Expo token (e.g. a raw FCM/APNs token)', () => {
      expect(service.isValidToken('not-a-real-token')).toBe(false);
    });
  });

  describe('send', () => {
    it('returns an empty array for no messages without calling Expo', async () => {
      const spy = jest.spyOn(Expo.prototype, 'sendPushNotificationsAsync');
      const result = await service.send([]);
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('sends messages and returns tickets in order', async () => {
      const tickets: ExpoPushTicket[] = [
        { status: 'ok', id: 'ticket-1' },
        { status: 'ok', id: 'ticket-2' },
      ];
      jest.spyOn(Expo.prototype, 'sendPushNotificationsAsync').mockResolvedValue(tickets);

      const result = await service.send([
        { to: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', title: 'A', body: 'a' },
        { to: 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', title: 'B', body: 'b' },
      ]);

      expect(result).toEqual(tickets);
    });

    it('turns a chunk-level network failure into per-message error tickets instead of throwing', async () => {
      jest.spyOn(Expo.prototype, 'sendPushNotificationsAsync').mockRejectedValue(new Error('network down'));

      const result = await service.send([
        { to: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', title: 'A', body: 'a' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ status: 'error', message: 'network down' });
    });
  });
});
