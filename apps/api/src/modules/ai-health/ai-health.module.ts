import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIHealthController } from './ai-health.controller';
import { AIHealthService } from './ai-health.service';
import { AIContextBuilder } from './ai-context-builder.service';
import { AIContextBuilderService } from './ai-context-builder-enhanced.service';
import { AIResponseService } from './ai-response.service';
import { AIHealthSafetyService } from './ai-safety.service';
import { AIPromptBuilder } from './prompts';
import { OpenAIProvider } from './providers/openai.provider';
import { HealthTrendsModule } from '../health-trends/health-trends.module';
import { AIHistoryModule } from '../ai-history/ai-history.module';
import { AILoggingModule } from '../ai-logging/ai-logging.module';
import { AICacheModule } from '../ai-cache/ai-cache.module';

@Module({
  imports: [
    ConfigModule,
    HealthTrendsModule,
    AIHistoryModule,
    AILoggingModule,
    AICacheModule,
  ],
  controllers: [AIHealthController],
  providers: [
    AIHealthService,
    AIContextBuilder,
    AIContextBuilderService,
    AIResponseService,
    AIHealthSafetyService,
    AIPromptBuilder,
    OpenAIProvider,
  ],
  exports: [AIHealthService],
})
export class AIHealthModule {}
