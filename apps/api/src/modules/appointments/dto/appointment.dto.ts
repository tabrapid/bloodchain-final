import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType, AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
/**
 * Filters for an organisation's own appointment list.
 *
 * `limit` is a string on the wire and a number in the service; declared as a
 * validated integer here so the ValidationPipe converts it rather than the
 * service receiving `"50"` and doing arithmetic on it -- the shape of bug that
 * turned `?limit=5` on the notification inbox into a request for 51 rows.
 */
export class ListOrganizationAppointmentsDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: AppointmentType })
  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  /** A single day, YYYY-MM-DD. Takes precedence over the range below. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  /** Reference number, or the donor's name or email. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/** Staff-side reason for a no-show or a desk cancellation. */
export class StaffAppointmentActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
