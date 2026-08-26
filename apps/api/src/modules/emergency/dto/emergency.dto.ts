import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, ComponentType, RhFactor } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const URGENCY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export class CreateEmergencyDto {
  @ApiProperty({ enum: BloodType })
  @IsEnum(BloodType)
  bloodType!: BloodType;

  @ApiProperty({ enum: RhFactor })
  @IsEnum(RhFactor)
  rhFactor!: RhFactor;

  @ApiPropertyOptional({ enum: ComponentType, description: 'Defaults to WHOLE_BLOOD when omitted.' })
  @IsOptional()
  @IsEnum(ComponentType)
  componentType?: ComponentType;

  @ApiProperty()
  @IsInt()
  @Min(1)
  unitsRequired!: number;

  @ApiPropertyOptional({ enum: URGENCY_LEVELS })
  @IsOptional()
  @IsIn(URGENCY_LEVELS)
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requiredBefore?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  donationLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CancelEmergencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelEmergencyResponseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteEmergencyResponseDto {
  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: RhFactor })
  @IsOptional()
  @IsEnum(RhFactor)
  rhFactor?: RhFactor;

  @ApiPropertyOptional({ enum: ComponentType })
  @IsOptional()
  @IsEnum(ComponentType)
  componentType?: ComponentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  volumeMl?: number;
}

export class UpdateEmergencyLocationDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  speed?: number;
}
