import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

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
  promotional?: boolean;
}