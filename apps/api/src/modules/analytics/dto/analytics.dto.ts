import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DateRangeType {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

export class DateRangeDto {
  @ApiPropertyOptional({ enum: DateRangeType, default: DateRangeType.LAST_30_DAYS })
  @IsOptional()
  @IsEnum(DateRangeType)
  range?: DateRangeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class AnalyticsFilterDto extends DateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rhFactor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  componentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  urgencyLevel?: string;
}

export class KpiDto {
  value!: number;
  previousValue!: number | null;
  changePercent!: number | null;
  trend!: 'up' | 'down' | 'stable' | 'new';
  label!: string;
}

export class BloodGroupCountDto {
  bloodGroup!: string;
  rhFactor!: string;
  fullName!: string;
  count!: number;
  percent!: number;
}

export class TimeSeriesDataPointDto {
  date!: string;
  value!: number;
}

export class StatusCountDto {
  status!: string;
  count!: number;
  percent!: number;
}

export interface OverviewAnalytics {
  inventory: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    quarantinedUnits: number;
    lowStockGroups: string[];
    criticalGroups: string[];
    lastUpdated: string;
  };
  donations: {
    total: KpiDto;
    completed: KpiDto;
    cancelled: KpiDto;
    byBloodGroup: BloodGroupCountDto[];
  };
  emergencies: {
    total: KpiDto;
    active: KpiDto;
    completed: KpiDto;
    avgResponseTime: number | null;
    acceptanceRate: number | null;
  };
  appointments: {
    total: KpiDto;
    completed: KpiDto;
    cancelled: KpiDto;
    noShow: KpiDto;
    completionRate: number | null;
  };
  requests: {
    total: KpiDto;
    pending: KpiDto;
    fulfilled: KpiDto;
    fulfillmentRate: number | null;
  };
  shipments: {
    total: KpiDto;
    inTransit: KpiDto;
    delivered: KpiDto;
    failed: KpiDto;
    avgDeliveryTimeMinutes: number | null;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: ['CSV', 'XLSX', 'PDF'] })
  @IsOptional()
  @IsString()
  format?: 'CSV' | 'XLSX' | 'PDF';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}
