import Constants from 'expo-constants';
import { apiEnvironment } from '../api/config';

/**
 * Whether this build can register for push at all.
 *
 * Expo mints a push token against a project, and there is no Expo project for
 * this product yet (EXTERNAL_BLOCKER_EAS_PROJECT_ID). Without one
 * `getExpoPushTokenAsync` throws `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID`, which
 * the old code caught, logged to a console nobody reads in a store build, and
 * moved on from -- leaving the notification settings screen showing six
 * enabled toggles and an OS permission of "granted" on a build where push can
 * never arrive. The app was not failing to register; it was claiming to have.
 *
 * So the state is a value now, the app can show it, and a configuration
 * problem is distinguishable from a runtime one. No id is invented and none is
 * committed: the seam ships unset, and says so.
 */

/**
 * Where the id comes from, in order.
 *
 * `extra.eas.projectId` is what `app.config.ts` bakes in from
 * `EXPO_PUBLIC_EAS_PROJECT_ID`. `Constants.easConfig` is what EAS Build itself
 * writes into a binary it produced. The literal env read is last and must be
 * written out in full, because babel substitutes `EXPO_PUBLIC_*` names at
 * transform time -- a computed lookup would find nothing.
 */
export function resolveEasProjectId(): string | undefined {
  const fromConfig = (
    Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  )?.eas?.projectId;

  return (
    fromConfig?.trim() ||
    Constants.easConfig?.projectId?.trim() ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    undefined
  );
}

export type PushConfigState =
  /** An Expo project is configured; push can be registered. */
  | { readonly configured: true; readonly projectId: string }
  /**
   * No project. `expected` says whether that is a problem with this build or
   * simply what a local development build looks like, so the app can be quiet
   * about the second and explicit about the first.
   */
  | { readonly configured: false; readonly expected: boolean; readonly reason: string };

export function describePushConfig(
  projectId: string | undefined,
  environment: string,
): PushConfigState {
  if (projectId) return { configured: true, projectId };

  return {
    configured: false,
    // A developer running `expo start` has no EAS project and does not need
    // one. A build that leaves this machine and still has none is a build that
    // will never deliver an emergency alert.
    expected: environment === 'development',
    reason:
      environment === 'development'
        ? 'This development build has no Expo project, so push notifications are not registered.'
        : 'This build has no Expo project id, so it cannot receive push notifications at all. ' +
          'No Expo project exists for this product yet (EXTERNAL_BLOCKER_EAS_PROJECT_ID).',
  };
}

export const pushConfig: PushConfigState = describePushConfig(
  resolveEasProjectId(),
  apiEnvironment,
);
