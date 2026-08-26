import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emergencyRequests?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  appointments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  donationReminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  healthResults?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  system?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gamification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bloodRequests?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shipments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  security?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emergencyOverride?: boolean;
}
