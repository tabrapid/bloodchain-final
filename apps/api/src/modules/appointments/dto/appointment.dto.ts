import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType, AppointmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @ApiPropertyOptional()
  @IsString()
  slotId!: string;

  @ApiPropertyOptional({ enum: AppointmentType })
  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RescheduleAppointmentDto {
  @ApiPropertyOptional()
  @IsString()
  newSlotId!: string;
}

export class GetMyAppointmentsDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: AppointmentType })
  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upcoming?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  past?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;
}