import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, RhFactor, VerificationSource } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyBloodTypeDto {
  @ApiPropertyOptional({ enum: BloodType })
  @IsEnum(BloodType)
  bloodType!: BloodType;

  @ApiPropertyOptional({ enum: RhFactor })
  @IsEnum(RhFactor)
  rhFactor!: RhFactor;

  @ApiPropertyOptional({ enum: VerificationSource })
  @IsEnum(VerificationSource)
  source!: VerificationSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}