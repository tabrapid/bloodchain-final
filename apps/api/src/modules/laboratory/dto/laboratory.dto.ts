import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ResultFlag } from '@prisma/client';

/**
 * P3-14: these three routes previously declared their request bodies as inline
 * anonymous types (`@Body() dto: { ... }`). NestJS's ValidationPipe skips
 * validation when the resolved metatype is a native type, and an inline object
 * type resolves to `Object` — so the app's global `whitelist` /
 * `forbidNonWhitelisted` / `transform` policy did not apply to any of them, and
 * Swagger documented no request body.
 */

export class BookLaboratoryAppointmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  laboratoryId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  testTypeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelLaboratoryAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class LaboratoryResultItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  parameterId!: string;

  @ApiProperty({ description: 'The result as recorded, e.g. "13.4" or "Negative"' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  /**
   * Deliberately not `@IsOptional()` + implicit conversion alone: the service
   * stores this as a `Prisma.Decimal`, so a non-numeric value here used to
   * reach the Decimal constructor and surface as a 500 rather than a 400.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  numericValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional({ enum: ResultFlag })
  @IsOptional()
  @IsEnum(ResultFlag)
  flag?: ResultFlag;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateLaboratoryResultDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appointmentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  testTypeId!: string;

  @ApiProperty({ type: [LaboratoryResultItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LaboratoryResultItemDto)
  items!: LaboratoryResultItemDto[];
}
