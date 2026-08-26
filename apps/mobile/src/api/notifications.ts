import { apiRequest } from './client';
import { apiBasePath } from './config';

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

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED' | 'EXPIRED';

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  deepLink?: string;
  status: NotificationStatus;
  readAt?: string;
  expiresAt?: string;
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emergencyRequests: boolean;
  appointments: boolean;
  donationReminders: boolean;
  healthResults: boolean;
  gamification: boolean;
  bloodRequests: boolean;
  shipments: boolean;
  inventory: boolean;
  system: boolean;
  security: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone: string;
  emergencyOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesInput {
  emergencyRequests?: boolean;
  appointments?: boolean;
  donationReminders?: boolean;
  healthResults?: boolean;
  gamification?: boolean;
  bloodRequests?: boolean;
  shipments?: boolean;
  inventory?: boolean;
  system?: boolean;
  security?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
  emergencyOverride?: boolean;
}

export interface NotificationFilter {
  type?: NotificationType;
  status?: NotificationStatus;
  isRead?: boolean;
  limit?: number;
  cursor?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export interface RegisterPushDeviceInput {
  token: string;
  platform: string;
  deviceId?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export async function getNotifications(
  filter?: NotificationFilter,
): Promise<{ items: Notification[]; nextCursor?: string }> {
  const params = new URLSearchParams();
  if (filter?.type) params.append('type', filter.type);
  if (filter?.status) params.append('status', filter.status);
  if (filter?.isRead !== undefined) params.append('isRead', String(filter.isRead));
  if (filter?.limit) params.append('limit', String(filter.limit));
  if (filter?.cursor) params.append('cursor', filter.cursor);

  const query = params.toString();
  return apiRequest(`${apiBasePath}/notifications${query ? `?${query}` : ''}`);
}

export async function getNotification(id: string): Promise<Notification> {
  return apiRequest(`${apiBasePath}/notifications/${id}`);
}

export async function getNotificationStats(): Promise<NotificationStats> {
  return apiRequest(`${apiBasePath}/notifications/stats`);
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiRequest(`${apiBasePath}/notifications/unread-count`);
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  return apiRequest(`${apiBasePath}/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markNotificationAsUnread(id: string): Promise<Notification> {
  return apiRequest(`${apiBasePath}/notifications/${id}/unread`, { method: 'PATCH' });
}

export async function archiveNotification(id: string): Promise<Notification> {
  return apiRequest(`${apiBasePath}/notifications/${id}/archive`, { method: 'PATCH' });
}

export async function unarchiveNotification(id: string): Promise<Notification> {
  return apiRequest(`${apiBasePath}/notifications/${id}/unarchive`, { method: 'PATCH' });
}

export async function markAllNotificationsAsRead(): Promise<{ count: number }> {
  return apiRequest(`${apiBasePath}/notifications/mark-all-read`, { method: 'PATCH' });
}

export async function markNotificationsRead(ids: string[]): Promise<{ success: boolean }> {
  return apiRequest(`${apiBasePath}/notifications/mark-read`, {
    method: 'POST',
    body: JSON.stringify({ notificationIds: ids }),
  });
}

export async function deleteNotification(id: string): Promise<void> {
  return apiRequest(`${apiBasePath}/notifications/${id}`, { method: 'DELETE' });
}

export async function getNotificationPreferences(): Promise<{ data: NotificationPreferences }> {
  return apiRequest(`${apiBasePath}/notifications/preferences`);
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput,
): Promise<{ data: NotificationPreferences }> {
  return apiRequest(`${apiBasePath}/notifications/preferences`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function registerPushDevice(input: RegisterPushDeviceInput): Promise<void> {
  return apiRequest(`${apiBasePath}/notifications/devices/register`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deactivatePushDevice(id: string): Promise<void> {
  return apiRequest(`${apiBasePath}/notifications/devices/${id}/deactivate`, { method: 'POST' });
}

export async function deactivateAllPushDevices(): Promise<void> {
  return apiRequest(`${apiBasePath}/notifications/devices/deactivate-all`, { method: 'POST' });
}
