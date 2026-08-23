import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrendPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  value!: number;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  referenceMin?: number;

  @ApiPropertyOptional()
  referenceMax?: number;

  @ApiPropertyOptional()
  laboratoryId?: string;

  @ApiPropertyOptional()
  laboratoryName?: string;

  @ApiPropertyOptional()
  resultId?: string;

  @ApiPropertyOptional()
  flag?: string;
}

export class TrendDataDto {
  @ApiProperty()
  parameterCode!: string;

  @ApiProperty()
  parameterName!: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  latestValue!: number;

  @ApiPropertyOptional()
  latestValueDate?: string;

  @ApiPropertyOptional()
  latestValueLaboratory?: string;

  @ApiPropertyOptional()
  previousValue?: number;

  @ApiPropertyOptional()
  previousValueDate?: string;

  @ApiPropertyOptional()
  absoluteChange?: number;

  @ApiPropertyOptional()
  percentageChange?: number;

  @ApiPropertyOptional()
  referenceMin?: number;

  @ApiPropertyOptional()
  referenceMax?: number;

  @ApiProperty()
  trend!: 'INCREASING' | 'DECREASING' | 'STABLE' | 'INSUFFICIENT_DATA';

  @ApiProperty()
  points!: TrendPointDto[];

  @ApiProperty()
  hasReferenceRange!: boolean;
}

export class ParameterStatisticsDto {
  @ApiProperty()
  parameterCode!: string;

  @ApiProperty()
  parameterName!: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiProperty()
  measurementCount!: number;

  @ApiPropertyOptional()
  latest?: number;

  @ApiPropertyOptional()
  latestDate?: string;

  @ApiPropertyOptional()
  minimum?: number;

  @ApiPropertyOptional()
  minimumDate?: string;

  @ApiPropertyOptional()
  maximum?: number;

  @ApiPropertyOptional()
  maximumDate?: string;

  @ApiPropertyOptional()
  average?: number;

  @ApiPropertyOptional()
  firstValue?: number;

  @ApiPropertyOptional()
  firstDate?: string;

  @ApiPropertyOptional()
  latestLaboratory?: string;
}

export class AvailableParameterDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  measurementCount!: number;

  @ApiPropertyOptional()
  latestValue?: number;

  @ApiPropertyOptional()
  latestValueDate?: string;

  @ApiPropertyOptional()
  hasReferenceRange?: boolean;
}

export class TrendSummaryDto {
  @ApiProperty()
  totalTests!: number;

  @ApiPropertyOptional()
  totalParameters?: number;

  @ApiPropertyOptional()
  lastTestDate?: string;

  @ApiPropertyOptional()
  lastTestLaboratory?: string;

  @ApiPropertyOptional()
  nextUpcomingAppointment?: string;

  @ApiProperty()
  availableParameters!: AvailableParameterDto[];

  @ApiPropertyOptional()
  recentTrend?: TrendDataDto;
}

export class TrendHistoryItemDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  value!: number;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  laboratoryId?: string;

  @ApiPropertyOptional()
  laboratoryName?: string;

  @ApiPropertyOptional()
  resultId?: string;

  @ApiPropertyOptional()
  testTypeName?: string;

  @ApiPropertyOptional()
  referenceMin?: number;

  @ApiPropertyOptional()
  referenceMax?: number;

  @ApiPropertyOptional()
  flag?: string;
}

export class TrendHistoryResponseDto {
  @ApiProperty()
  parameterCode!: string;

  @ApiProperty()
  parameterName!: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiProperty()
  hasReferenceRange!: boolean;

  @ApiPropertyOptional()
  referenceMin?: number;

  @ApiPropertyOptional()
  referenceMax?: number;

  @ApiProperty()
  history!: TrendHistoryItemDto[];

  @ApiProperty()
  total!: number;
}
