/**
 * The notification shapes the API actually returns.
 *
 * `GET /notifications` answers `{ data: { items, nextCursor } }` -- a cursor
 * envelope, not the `{ data, meta }` page envelope the admin routes use. The
 * three portals each unwrap `data` in their own request helper, so what a
 * caller here receives is the inner `{ items, nextCursor }`.
 */
export type NotificationType =
  | 'EMERGENCY'
  | 'DONATION'
  | 'APPOINTMENT'
  | 'LABORATORY'
  | 'AI'
  | 'GAMIFICATION'
  | 'BLOOD_REQUEST'
  | 'SHIPMENT'
  | 'INVENTORY'
  | 'SECURITY'
  | 'SYSTEM';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type NotificationStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'ARCHIVED'
  | 'EXPIRED';

export interface StaffNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  /** The mobile app's route. The portals resolve their own from sourceType. */
  deepLink?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: StaffNotification[];
  nextCursor: string | null;
}

export interface NotificationListFilters {
  type?: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  isRead?: boolean;
  limit?: number;
  cursor?: string;
}
