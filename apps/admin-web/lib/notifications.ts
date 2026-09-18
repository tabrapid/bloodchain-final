import { createNotificationsClient, type StaffNotification } from '@bloodchain/ui/notifications';

import { apiRequest } from './client';

/**
 * This portal's notification routes, bound to its own request helper.
 *
 * The routes themselves live in `@bloodchain/ui/notifications` so all three
 * consoles read the same inbox the same way; what belongs here is only what is
 * specific to this portal -- its API client, and where a notification points.
 */
export const notificationsClient = createNotificationsClient(apiRequest);

/**
 * Where a notification belongs in the platform administration console.
 *
 * The notification's stored `deepLink` is the *mobile* app's route
 * (`/(app)/home`, `/(app)/security`), so following it here would be a dead
 * link. Each portal maps `sourceType` to its own routes instead, and returns
 * null for a source it has no page for -- an unclickable row is better than one
 * that navigates nowhere.
 */
export function resolveNotificationHref(notification: StaffNotification): string | null {
  switch (notification.sourceType) {
    case 'SHIPMENT':
      return '/shipments';
    case 'BLOOD_REQUEST':
      return '/requests';
    case 'SOS_REQUEST':
    case 'SOS_RESPONSE':
      return '/emergencies';
    case 'INVENTORY':
      return '/inventory';
    case 'SECURITY':
    case 'ADMIN':
      return '/settings';
    default:
      return null;
  }
}
