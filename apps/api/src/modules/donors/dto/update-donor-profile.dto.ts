import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, DonorStatus, RhFactor } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentLocation?: boolean;
}
