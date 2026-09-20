import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType, BloodType, BloodUnitStatus, ComponentType, LocationType, MovementType, ReservationStatus, RhFactor } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
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

/**
 * Filters for the cross-organisation availability view.
 *
 * Declared rather than typed inline: an inline `@Query() filters: { ... }`
 * resolves to `Object`, which makes NestJS's ValidationPipe skip the whole
 * body -- the same defect P3-14 fixed on four other routes. Here it meant
 * `?bloodType=nonsense` reached Prisma as an enum value and produced a 500
 * instead of a 400.
 */
export class GetBloodAvailabilityDto {
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
  @ApiPropertyOptional({ description: 'Why this unit was issued' })
  @IsOptional()
  @IsString()
  reason?: string;

  /**
   * The recipient reference, as its own field rather than buried in `reason`.
   *
   * It used to be prose: the old description asked staff to "include a
   * patient/recipient reference here if applicable", which put the one fact a
   * look-back needs into a free-text column nothing can query (CL-03).
   *
   * The string is OPAQUE and this repository attaches no identity policy to
   * it. What identifies a transfusion recipient in this jurisdiction -- a
   * national ID, a hospital number, something else -- is an unresolved legal
   * and clinical question (PR-02), and inventing an answer here would write an
   * identity workflow nobody asked for into the API. Optional for the same
   * reason: refusing an issue for want of a format that has not been agreed
   * would block real work over an open question.
   */
  @ApiPropertyOptional({
    description:
      'Opaque reference for the receiving patient or ward, recorded for traceability. No identity format is imposed or validated.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientReference?: string;
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