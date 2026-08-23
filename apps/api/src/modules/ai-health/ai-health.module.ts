import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIHealthController } from './ai-health.controller';
import { AIHealthService } from './ai-health.service';
import { AIContextBuilder } from './ai-context-builder.service';
import { AIResponseService } from './ai-response.service';
import { AIHealthSafetyService } from './ai-safety.service';
import { AIPromptBuilder } from './prompts';
import { OpenAIProvider } from './providers/openai.provider';
import { HealthTrendsModule } from '../health-trends/health-trends.module';

@Module({
  imports: [ConfigModule, HealthTrendsModule],
  controllers: [AIHealthController],
  providers: [
    AIHealthService,
    AIContextBuilder,
    AIResponseService,
    AIHealthSafetyService,
    AIPromptBuilder,
    OpenAIProvider,
  ],
  exports: [AIHealthService],
})
export class AIHealthModule {}
