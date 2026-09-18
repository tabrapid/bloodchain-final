import { createNotificationsClient, type StaffNotification } from '@bloodchain/ui/notifications';

import { apiRequest } from './api-client';

/**
 * This portal's notification routes, bound to its own request helper.
 *
 * The routes themselves live in `@bloodchain/ui/notifications` so all three
 * consoles read the same inbox the same way; what belongs here is only what is
 * specific to this portal -- its API client, and where a notification points.
 */
export const notificationsClient = createNotificationsClient(apiRequest);

/**
 * Where a notification belongs in the hospital console.
 *
 * The notification's stored `deepLink` is the *mobile* app's route
 * (`/(app)/home`, `/(app)/security`), so following it here would be a dead
 * link. Each portal maps `sourceType` to its own routes instead, and returns
 * null for a source it has no page for -- an unclickable row is better than one
 * that navigates nowhere.
 */
export function resolveNotificationHref(notification: StaffNotification): string | null {
  const id = notification.sourceId;

  switch (notification.sourceType) {
    case 'SHIPMENT':
      return id ? `/shipments/${id}` : '/shipments';
    case 'BLOOD_REQUEST':
      return id ? `/requests/${id}` : '/requests';
    case 'APPOINTMENT':
      return '/appointments';
    case 'DONATION':
      return '/donations';
    case 'SOS_REQUEST':
    case 'SOS_RESPONSE':
      return '/emergency';
    case 'INVENTORY':
      return '/inventory';
    case 'SECURITY':
      return '/settings';
    default:
      return null;
  }
}
