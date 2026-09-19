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
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { AIHealthService } from './ai-health.service';
import { AIInsightType } from '@prisma/client';
import {
  GenerateInsightDto,
  ExplainResultDto,
  AnalyzeTrendDto,
  SendChatMessageDto,
  AiInsightResponseDto,
  ChatResponseDto,
  SubmitFeedbackDto,
  FeedbackResponseDto,
  AIFeedbackTypeDto,
} from './dto';

@ApiTags('AI Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/ai')
export class AIHealthController {
  constructor(private readonly aiHealthService: AIHealthService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Whether AI features are enabled for this deployment' })
  @ApiResponse({ status: 200, description: 'AI availability' })
  async getAvailability() {
    // Deliberately outside the throttle and open to any signed-in user: a
    // client has to be able to ask this before drawing a button, and the answer
    // is a feature flag, not data.
    //
    // Hand-wrapped in `{ data }` like the rest of this controller -- every
    // client's request helper ends in `return json.data`, and the response
    // envelope sweep enforces it.
    return { data: await this.aiHealthService.getAvailability() };
  }

  @Post('insights')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback for an AI insight' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  @ApiResponse({ status: 404, description: 'Insight not found' })
  @ApiResponse({ status: 409, description: 'Feedback already submitted' })
  async submitFeedback(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitFeedbackDto,
  ): Promise<{ data: FeedbackResponseDto }> {
    const feedback = await this.aiHealthService.submitFeedback(userId, dto);
    return {
      data: {
        id: feedback.id,
        userId: feedback.userId,
        insightId: feedback.insightId,
        type: feedback.type as unknown as AIFeedbackTypeDto,
        reason: feedback.reason,
        createdAt: feedback.createdAt.toISOString(),
      },
    };
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

  @Get('conversations')
  @ApiOperation({ summary: 'Get user AI conversations' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getConversations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.aiHealthService.getConversations(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { data: result };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get AI conversation detail' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversationDetail(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiHealthService.getConversationDetail(userId, id);
    return { data: result };
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an AI conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.aiHealthService.deleteConversation(userId, id);
  }
}

@ApiTags('AI Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN)
@Controller('admin/ai')
export class AIAdminController {
  constructor(private readonly aiHealthService: AIHealthService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get AI platform analytics' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getAnalytics(@Query('days') days?: string) {
    const result = await this.aiHealthService.getAnalytics(days ? parseInt(days, 10) : 30);
    return { data: result };
  }

  @Get('insight-stats')
  @ApiOperation({ summary: 'Get AI insight statistics' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getInsightStats(@Query('days') days?: string) {
    const result = await this.aiHealthService.getInsightStats(days ? parseInt(days, 10) : 30);
    return { data: result };
  }
}
