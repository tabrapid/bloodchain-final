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
 * Requests notification permission and registers this device's Expo push
 * token with the backend. Safe to call multiple times (e.g. on every login)
 * — the backend upserts by token. Never throws: a denied permission, a
 * missing EAS project ID, or a transient network failure just means this
 * device won't receive push notifications, not a broken app.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

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
