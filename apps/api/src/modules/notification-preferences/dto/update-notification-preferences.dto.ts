import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
