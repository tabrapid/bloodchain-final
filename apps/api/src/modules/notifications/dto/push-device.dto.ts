import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';

const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;

export class RegisterPushDeviceDto {
  @ApiProperty({ description: 'Expo push token, e.g. ExponentPushToken[xxxxxxxx]' })
  @IsString()
  @MaxLength(255)
  token!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class UpdatePushDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @OptionalBooleanField()
  isActive?: boolean;
}

export interface PushDeviceFilterDto {
  userId?: string;
  isActive?: boolean;
  platform?: string;
}
