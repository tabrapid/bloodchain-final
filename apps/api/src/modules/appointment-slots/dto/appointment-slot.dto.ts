import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAppointmentSlotDto {
  @ApiPropertyOptional({ enum: AppointmentType })
  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @ApiPropertyOptional({ example: '2026-09-01T08:00:00Z' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ example: '2026-09-01T08:30:00Z' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}

export class UpdateAppointmentSlotDto {
  @ApiPropertyOptional({ example: '2026-09-01T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-09-01T08:30:00Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class GetAvailabilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: AppointmentType })
  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}