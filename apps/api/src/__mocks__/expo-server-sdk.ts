/**
 * Jest manual mock for expo-server-sdk (a Node ESM-only package with no CJS
 * build, incompatible with this project's CommonJS ts-jest transform).
 * Jest substitutes this automatically for any `expo-server-sdk` import in
 * tests — no `jest.mock('expo-server-sdk')` call needed. Individual tests
 * can still `jest.spyOn(Expo.prototype, 'sendPushNotificationsAsync')` to
 * control behavior, since this is a real class with real prototype methods.
 */

export type ExpoPushToken = string;

export interface ExpoPushMessage {
  to: ExpoPushToken | ExpoPushToken[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: unknown;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
  expiration?: number;
  [key: string]: unknown;
}

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string; expoPushToken?: string } };

export class Expo {
  static pushNotificationChunkSizeLimit = 100;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options?: Record<string, unknown>) {}

  static isExpoPushToken(token: unknown): token is ExpoPushToken {
    return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);
  }

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    return [messages];
  }

  async sendPushNotificationsAsync(_messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    return [];
  }
}

export default Expo;
