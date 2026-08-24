import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HealthTrendsService } from './health-trends.service';
import { GetTrendsDto, GetTrendSummaryDto } from './dto';
import {
  TrendDataDto,
  TrendSummaryDto,
  ParameterStatisticsDto,
  TrendHistoryResponseDto,
  AvailableParameterDto,
} from './dto/trend-response.dto';

@ApiTags('Health Trends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/health-trends')
export class HealthTrendsController {
  constructor(private readonly trendsService: HealthTrendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get health trends summary for current user' })
  @ApiResponse({ status: 200, type: TrendSummaryDto })
  async getSummary(
    @CurrentUser('sub') userId: string,
    @Query() dto: GetTrendSummaryDto,
  ): Promise<{ data: TrendSummaryDto }> {
    const summary = await this.trendsService.getSummary(userId, dto);
    return { data: summary };
  }

  @Get('parameters')
  @ApiOperation({ summary: 'Get available parameters with trend data' })
  @ApiResponse({ status: 200, type: [AvailableParameterDto] })
  async getAvailableParameters(
    @CurrentUser('sub') userId: string,
  ): Promise<{ data: AvailableParameterDto[] }> {
    const params = await this.trendsService.getAvailableParameters(userId);
    return { data: params };
  }

  @Get(':parameter')
  @ApiOperation({ summary: 'Get trend data for a specific parameter' })
  @ApiParam({ name: 'parameter', description: 'Parameter code (e.g., HEMOGLOBIN, RBC)' })
  @ApiResponse({ status: 200, type: TrendDataDto })
  @ApiResponse({ status: 404, description: 'Parameter not found or no data available' })
  async getParameterTrend(
    @CurrentUser('sub') userId: string,
    @Param('parameter') parameter: string,
    @Query() dto: GetTrendsDto,
  ): Promise<{ data: TrendDataDto | null }> {
    const trendData = await this.trendsService.getTrendData(userId, { ...dto, parameter });
    return { data: trendData };
  }

  @Get(':parameter/statistics')
  @ApiOperation({ summary: 'Get statistics for a specific parameter' })
  @ApiParam({ name: 'parameter', description: 'Parameter code' })
  @ApiResponse({ status: 200, type: ParameterStatisticsDto })
  @ApiResponse({ status: 404, description: 'Parameter not found' })
  async getParameterStatistics(
    @CurrentUser('sub') userId: string,
    @Param('parameter') parameter: string,
  ): Promise<{ data: ParameterStatisticsDto | null }> {
    const stats = await this.trendsService.getParameterStatistics(userId, parameter);
    return { data: stats };
  }

  @Get(':parameter/history')
  @ApiOperation({ summary: 'Get history for a specific parameter' })
  @ApiParam({ name: 'parameter', description: 'Parameter code' })
  @ApiResponse({ status: 200, type: TrendHistoryResponseDto })
  @ApiResponse({ status: 404, description: 'Parameter not found' })
  async getParameterHistory(
    @CurrentUser('sub') userId: string,
    @Param('parameter') parameter: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: TrendHistoryResponseDto | null }> {
    const history = await this.trendsService.getTrendHistory(
      userId,
      parameter,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
    return { data: history };
  }
}
