import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType, BloodType, BloodUnitStatus, ComponentType, LocationType, MovementType, ReservationStatus, RhFactor } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';

export class GetInventoryDto {
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

  @ApiPropertyOptional({ enum: BloodUnitStatus })
  @IsOptional()
  @IsEnum(BloodUnitStatus)
  status?: BloodUnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}

export class GetMovementsDto {
  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}

export class GetReservationsDto {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}

export class CreateLocationDto {
  @ApiPropertyOptional()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  code!: string;

  @ApiPropertyOptional({ enum: LocationType })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;
}

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @OptionalBooleanField()
  active?: boolean;
}

export class ReleaseUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QuarantineUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DiscardUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class IssueUnitDto {
  @ApiPropertyOptional({ description: 'Why this unit was issued - include a patient/recipient reference here if applicable' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustUnitDto {
  @ApiProperty({ description: 'Reason for this manual correction (required for the audit trail)' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  volumeMl?: number;

  @ApiPropertyOptional({ enum: ComponentType })
  @IsOptional()
  @IsEnum(ComponentType)
  componentType?: ComponentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class MoveUnitDto {
  @ApiPropertyOptional()
  @IsString()
  toLocationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReserveUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservedForOrganizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ReleaseReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateAlertDto {
  @ApiPropertyOptional({ enum: AlertType })
  @IsEnum(AlertType)
  type!: AlertType;

  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: RhFactor })
  @IsOptional()
  @IsEnum(RhFactor)
  rhFactor?: RhFactor;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  currentValue?: number;
}

export class AcknowledgeAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;
}