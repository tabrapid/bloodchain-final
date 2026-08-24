import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AIHealthService } from './ai-health.service';
import { AIInsightType } from '@prisma/client';
import {
  GenerateInsightDto,
  ExplainResultDto,
  AnalyzeTrendDto,
  SendChatMessageDto,
  AiInsightResponseDto,
  ChatResponseDto,
} from './dto';

@ApiTags('AI Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/me/ai')
export class AIHealthController {
  constructor(private readonly aiHealthService: AIHealthService) {}

  @Post('insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an AI health insight' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'AI not enabled or request out of scope' })
  @ApiResponse({ status: 404, description: 'Data not found' })
  async generateInsight(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateInsightDto,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.generateInsight(userId, dto);
    return { data: insight };
  }

  @Post('explain-result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get AI explanation for a specific result' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  async explainResult(
    @CurrentUser('sub') userId: string,
    @Body() dto: ExplainResultDto,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.explainResult(userId, dto);
    return { data: insight };
  }

  @Post('analyze-trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get AI analysis of a parameter trend' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  async analyzeTrend(
    @CurrentUser('sub') userId: string,
    @Body() dto: AnalyzeTrendDto,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.analyzeTrend(userId, dto);
    return { data: insight };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message to the AI assistant' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<{ data: ChatResponseDto }> {
    const response = await this.aiHealthService.chat(userId, dto);
    return { data: response };
  }

  @Post('donation-insight')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI insight about donation history' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  async generateDonationInsight(
    @CurrentUser('sub') userId: string,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.generateDonationInsight(userId);
    return { data: insight };
  }

  @Post('appointment-insight')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI insight about appointment history' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  async generateAppointmentInsight(
    @CurrentUser('sub') userId: string,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.generateAppointmentInsight(userId);
    return { data: insight };
  }

  @Post('health-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate comprehensive AI health summary' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  async generateHealthSummary(
    @CurrentUser('sub') userId: string,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.generateHealthSummary(userId);
    return { data: insight };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user insight history' })
  @ApiQuery({ name: 'type', required: false, enum: AIInsightType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getInsightHistory(
    @CurrentUser('sub') userId: string,
    @Query('type') type?: AIInsightType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.aiHealthService.getInsightHistory(userId, {
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { data: result };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get a specific insight from history' })
  @ApiResponse({ status: 200, type: AiInsightResponseDto })
  @ApiResponse({ status: 404, description: 'Insight not found' })
  async getInsight(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<{ data: AiInsightResponseDto }> {
    const insight = await this.aiHealthService.getInsight(userId, id);
    return { data: insight };
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an insight from history' })
  @ApiResponse({ status: 204, description: 'Insight deleted' })
  @ApiResponse({ status: 404, description: 'Insight not found' })
  async deleteInsight(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.aiHealthService.deleteInsight(userId, id);
  }
}
