export interface UpdateNotificationPreferencesDto {
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

export interface NotificationPreferenceResponseDto {
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
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  emergencyOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}
