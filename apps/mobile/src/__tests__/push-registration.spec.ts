const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetToken = jest.fn();
const mockSetChannel = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...(args as [])),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...(args as [])),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

const mockRegisterDevice = jest.fn(async () => undefined);
jest.mock('../api/notifications', () => ({
  registerPushDevice: (...args: unknown[]) => mockRegisterDevice(...(args as [])),
}));

import { registerForPushNotificationsAsync } from '../notifications/push';

beforeEach(() => {
  mockGetPermissions.mockReset();
  mockRequestPermissions.mockReset();
  mockGetToken.mockReset().mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
  mockRegisterDevice.mockClear();
});

/**
 * S11 B3: registering a device must never be the thing that asks for
 * permission.
 *
 * This function used to call `requestPermissionsAsync()` itself, and
 * `usePushNotifications` calls it the moment authentication succeeds -- so the
 * system prompt appeared on whatever screen the donor happened to be looking
 * at, before a word had been said about what would be sent. On iOS that prompt
 * never comes back: one reflexive "Don't Allow" and emergency alerts are off
 * for good.
 */
describe('push registration never prompts', () => {
  it('asks the operating system nothing when permission has not been decided', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });

    await registerForPushNotificationsAsync();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('asks nothing, and registers nothing, when permission was refused', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    await registerForPushNotificationsAsync();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('registers the device when permission is already granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });

    await registerForPushNotificationsAsync();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockRegisterDevice).toHaveBeenCalledTimes(1);
  });
});
