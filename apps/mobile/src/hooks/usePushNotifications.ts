import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/auth.store';
import { registerForPushNotificationsAsync } from '../notifications/push';

function navigateToDeepLink(data: unknown) {
  const deepLink = (data as { deepLink?: string } | undefined)?.deepLink;
  if (deepLink) {
    router.push(deepLink as any);
  }
}

/**
 * Registers this device for push notifications once authenticated, and
 * routes to a notification's deepLink when the user taps it — both from a
 * running app and from a cold start (app opened via the notification).
 */
export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateToDeepLink(response.notification.request.content.data);
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToDeepLink(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, []);
}
