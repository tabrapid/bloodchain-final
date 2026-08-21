import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface NotificationPreferences {
  id: string;
  emergencyRequests: boolean;
  appointments: boolean;
  donationReminders: boolean;
  healthResults: boolean;
  system: boolean;
  promotional: boolean;
}

export interface UpdateNotificationPreferencesInput {
  emergencyRequests?: boolean;
  appointments?: boolean;
  donationReminders?: boolean;
  healthResults?: boolean;
  system?: boolean;
  promotional?: boolean;
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