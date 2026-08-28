import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBloodRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deliveryLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deliveryLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsArray()
  items!: Array<{
    bloodType: string;
    rhFactor: string;
    componentType?: string;
    unitsRequested: number;
  }>;
}

export class GetRequestsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: 'requesting' | 'fulfilling';
}

export class ApproveRequestDto {
  @IsArray()
  items!: Array<{
    itemId: string;
    unitsApproved: number;
  }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pickupLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pickupLongitude?: number;
}

export class GetShipmentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: 'source' | 'destination';
}

export class AssignCourierDto {
  @IsString()
  courierId!: string;
}

export class DeclineShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

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

export class ConfirmDeliveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verificationCode?: string;
}

export class FailShipmentDto {
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReassignCourierDto {
  @IsString()
  courierId!: string;
}

export class DeliveryConfirmationDto {
  @IsNumber()
  @Min(0)
  unitsReceived!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discrepancyReason?: string;
}
