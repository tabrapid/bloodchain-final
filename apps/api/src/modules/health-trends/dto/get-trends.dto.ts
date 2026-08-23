import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class GetTrendsDto {
  @ApiPropertyOptional({ description: 'Filter by parameter code (e.g., HEMOGLOBIN, RBC)' })
  @IsOptional()
  @IsString()
  parameter?: string;

  @ApiPropertyOptional({ description: 'Time range: 1M, 3M, 6M, 1Y, 2Y, ALL' })
  @IsOptional()
  @IsString()
  range?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by test category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Laboratory ID' })
  @IsOptional()
  @IsString()
  laboratory?: string;
}

export class GetTrendSummaryDto {
  @ApiPropertyOptional({ description: 'Time range: 1M, 3M, 6M, 1Y, 2Y, ALL' })
  @IsOptional()
  @IsString()
  range?: string;
}
