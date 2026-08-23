import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourierStatus } from '@prisma/client';

export class UpdateCourierStatusDto {
  @ApiPropertyOptional({ enum: CourierStatus })
  @IsOptional()
  @IsEnum(CourierStatus)
  status?: CourierStatus;
}

export class UpdateCourierProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class GetCourierProfileResponseDto {
  id!: string;
  displayName!: string;
  phone!: string | null;
  status!: CourierStatus;
  organizationId!: string;
  organizationName!: string;
  currentShipmentId!: string | null;
  user!: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}
