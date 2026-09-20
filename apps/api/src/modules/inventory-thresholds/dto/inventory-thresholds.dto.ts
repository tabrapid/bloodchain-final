import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, ComponentType, RhFactor } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertThresholdDto {
  /** Omit both blood fields for the organisation's default threshold. */
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

  /**
   * Units at or below which the organisation wants a low-stock alert.
   *
   * No default, no suggested value, and no range beyond "a whole number of
   * units". What counts as low is a property of the site and its catchment, and
   * this repository is not entitled to an opinion about it.
   */
  @ApiProperty({ minimum: 0, description: 'Raise a LOW_STOCK alert when stock falls below this many units.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}
