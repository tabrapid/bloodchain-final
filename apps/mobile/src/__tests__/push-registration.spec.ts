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

// The seam under test in the second describe below. Declared as a mutable
// object so a case can say what this build was configured with.
const pushConfig: { configured: boolean; projectId?: string; expected?: boolean; reason?: string } = {
  configured: true,
  projectId: 'project-from-the-build',
};
jest.mock('../notifications/push-config', () => ({
  get pushConfig() {
    return pushConfig;
  },
}));

import { registerForPushNotificationsAsync } from '../notifications/push';

beforeEach(() => {
  mockGetPermissions.mockReset();
  mockRequestPermissions.mockReset();
  mockGetToken.mockReset().mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
  mockRegisterDevice.mockClear();
  pushConfig.configured = true;
  pushConfig.projectId = 'project-from-the-build';
  pushConfig.expected = false;
  pushConfig.reason = undefined;
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

/**
 * A build that cannot do push says so.
 *
 * There is no Expo project for this product yet, so `getExpoPushTokenAsync`
 * throws `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID`. The old code caught that
 * alongside every network error, warned once to a console nobody reads in a
 * store build, and returned as though nothing had happened -- leaving the
 * notification settings screen offering six toggles over a build where no
 * notification can ever arrive.
 */
describe('push registration reports why it did not happen', () => {
  it('tells the caller the device is registered', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    await expect(registerForPushNotificationsAsync()).resolves.toBe('registered');
  });

  it('distinguishes a refused permission from a broken build', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
    await expect(registerForPushNotificationsAsync()).resolves.toBe('permission-not-granted');
  });

  it('does not even attempt a token when the build has no Expo project', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    pushConfig.configured = false;
    pushConfig.expected = false;
    pushConfig.reason = 'no project';

    await expect(registerForPushNotificationsAsync()).resolves.toBe('not-configured');
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('separates a configuration problem from a runtime one', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockRejectedValue(new Error('APNs said no'));

    // Configured, permitted, and it still failed: that is worth retrying, and
    // it is not the same fact as having no project at all.
    await expect(registerForPushNotificationsAsync()).resolves.toBe('failed');
  });

  it('passes the configured project id through rather than calling with nothing', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    await registerForPushNotificationsAsync();
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'project-from-the-build' });
  });
});
