import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushDevice } from '../api/notifications';
import { pushConfig } from './push-config';

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
 * denied permission or a transient network failure means this device will not
 * receive push notifications, not a broken app.
 *
 * What it no longer does is treat "this build cannot do push at all" as the
 * same event. That is a configuration fact, known before anything is attempted,
 * and it is reported rather than caught -- see `push-config.ts` and the
 * notification settings screen, which now says so instead of showing six
 * enabled toggles over a build where nothing can arrive.
 */
export type PushRegistrationOutcome =
  | 'registered'
  | 'permission-not-granted'
  /** The build has no Expo project. Nothing was attempted; nothing could work. */
  | 'not-configured'
  /** Configured and permitted, but the attempt failed. Worth retrying. */
  | 'failed';

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationOutcome> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return 'permission-not-granted';
    }

    // Checked before the call, not inferred from the exception it throws.
    // `getExpoPushTokenAsync` fetches a device token from FCM or APNs *before*
    // it looks at the project id, so a missing credential and a missing
    // project produced the same single line in a log -- one of which is a
    // deployment problem and the other of which is this repository's.
    if (!pushConfig.configured) {
      if (!pushConfig.expected) console.error(`[push] ${pushConfig.reason}`);
      return 'not-configured';
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: pushConfig.projectId,
    });

    await registerPushDevice({
      token: tokenResponse.data,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    });
    return 'registered';
  } catch (error) {
    console.warn('[push] registration failed:', error);
    return 'failed';
  }
}
