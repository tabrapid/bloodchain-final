import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushDevice } from '../api/notifications';

// Show alerts/sounds while the app is foregrounded instead of staying silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers this device's Expo push token with the backend, if -- and only if
 * -- the operating system has already granted permission.
 *
 * It used to call `requestPermissionsAsync()` itself, which meant the system
 * prompt appeared the instant authentication succeeded, on whatever screen the
 * donor happened to be looking at, before a word had been said about what
 * would be sent. On iOS that prompt never comes back: one reflexive "Don't
 * Allow" and emergency alerts are off for good.
 *
 * Asking is now the job of a screen that can explain itself first -- the
 * onboarding notifications step -- and it calls this afterwards. This function
 * only ever registers a device that has already said yes, so calling it on
 * every login is silent for a donor who has not been asked yet.
 *
 * Safe to call multiple times: the backend upserts by token. Never throws: a
 * denied permission, a missing EAS project ID or a transient network failure
 * just means this device will not receive push notifications, not a broken app.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await registerPushDevice({
      token: tokenResponse.data,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    });
  } catch (error) {
    console.warn('[push] registration skipped:', error);
  }
}
