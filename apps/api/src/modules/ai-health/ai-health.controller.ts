import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AIHealthService } from './ai-health.service';
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
}
