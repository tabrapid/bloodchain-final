export interface RegisterPushDeviceDto {
  token: string;
  platform: string;
  deviceId?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdatePushDeviceDto {
  locale?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface PushDeviceFilterDto {
  userId?: string;
  isActive?: boolean;
  platform?: string;
}
