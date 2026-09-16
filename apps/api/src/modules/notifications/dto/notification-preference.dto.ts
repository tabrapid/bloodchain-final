import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpdateNotificationPreferencesDto {
  @OptionalBooleanField()
  emergencyRequests?: boolean;

  @OptionalBooleanField()
  appointments?: boolean;

  @OptionalBooleanField()
  donationReminders?: boolean;

  @OptionalBooleanField()
  healthResults?: boolean;

  @OptionalBooleanField()
  gamification?: boolean;

  @OptionalBooleanField()
  bloodRequests?: boolean;

  @OptionalBooleanField()
  shipments?: boolean;

  @OptionalBooleanField()
  inventory?: boolean;

  @OptionalBooleanField()
  system?: boolean;

  @OptionalBooleanField()
  security?: boolean;

  @OptionalBooleanField()
  quietHoursEnabled?: boolean;

  @ApiPropertyOptional({ description: '24-hour HH:mm, e.g. 22:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN)
  quietHoursStart?: string;

  @ApiPropertyOptional({ description: '24-hour HH:mm, e.g. 07:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN)
  quietHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietHoursTimezone?: string;

  @OptionalBooleanField()
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
