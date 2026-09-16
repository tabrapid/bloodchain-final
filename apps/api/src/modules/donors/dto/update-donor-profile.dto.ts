import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, DonorStatus, RhFactor } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';

export class UpdateDonorProfileDto {
  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: RhFactor })
  @IsOptional()
  @IsEnum(RhFactor)
  rhFactor?: RhFactor;

  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Marina District' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ enum: DonorStatus })
  @IsOptional()
  @IsEnum(DonorStatus)
  donorStatus?: DonorStatus;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @OptionalBooleanField('Whether the donor consents to their location being used')
  consentLocation?: boolean;

  @ApiPropertyOptional({ description: 'Only used when consentLocation is true.' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Only used when consentLocation is true.' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
