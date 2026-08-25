import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

/**
 * Thin wrapper around expo-server-sdk. The mobile app is Expo-managed, so
 * Expo's push service (which relays to APNs/FCM on our behalf) is the
 * correct transport — no separate Apple/Google credentials needed.
 */
@Injectable()
export class PushProviderService {
  private readonly logger = new Logger(PushProviderService.name);
  private readonly expo: Expo;

  constructor(config: ConfigService) {
    const accessToken = config.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo(accessToken ? { accessToken } : undefined);
  }

  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Sends messages via Expo's push service, chunked as Expo requires, and
   * returns one ticket per message in the same order as the input. If an
   * entire chunk fails to send (e.g. network error), every message in that
   * chunk still gets an 'error' ticket so callers never have to special-case
   * a thrown exception.
   */
  async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
      return [];
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      } catch (error) {
        const message = (error as Error).message;
        this.logger.error(`Expo push chunk of ${chunk.length} message(s) failed: ${message}`);
        for (let i = 0; i < chunk.length; i++) {
          tickets.push({ status: 'error', message });
        }
      }
    }

    return tickets;
  }
}
