import type { NotificationListFilters, NotificationPage, StaffNotification } from './types';

/**
 * Each portal's own `apiRequest`, which already handles the base URL, the
 * bearer token, the refresh-and-retry and unwrapping `{ data }`.
 */
export type ApiRequest = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export interface NotificationsClient {
  list(filters?: NotificationListFilters): Promise<NotificationPage>;
  unreadCount(): Promise<number>;
  markRead(id: string): Promise<StaffNotification>;
  markAllRead(): Promise<unknown>;
  archive(id: string): Promise<StaffNotification>;
}

/**
 * The notification routes, written once.
 *
 * All three portals need the same five calls, and the sprint brief is explicit
 * that the notification domain must not be re-implemented per client. What is
 * app-specific -- the base URL, the token, where a notification links to --
 * stays in the app: this takes the app's request helper and returns the routes
 * bound to it.
 */
export function createNotificationsClient(request: ApiRequest): NotificationsClient {
  return {
    async list(filters = {}) {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.status) params.set('status', filters.status);
      if (filters.isRead !== undefined) params.set('isRead', String(filters.isRead));
      if (filters.limit !== undefined) params.set('limit', String(filters.limit));
      if (filters.cursor) params.set('cursor', filters.cursor);

      const query = params.toString();
      return request<NotificationPage>(`/notifications${query ? `?${query}` : ''}`);
    },

    async unreadCount() {
      // This route answers `{ data: { count } }`, unlike the others.
      const result = await request<{ count: number }>('/notifications/unread-count');
      return result?.count ?? 0;
    },

    markRead(id) {
      return request<StaffNotification>(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    markAllRead() {
      return request<unknown>('/notifications/mark-all-read', { method: 'PATCH' });
    },

    archive(id) {
      return request<StaffNotification>(`/notifications/${id}/archive`, { method: 'PATCH' });
    },
  };
}
