import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIHealthController, AIAdminController } from './ai-health.controller';
import { AIHealthService } from './ai-health.service';
import { AIContextBuilder } from './ai-context-builder.service';
import { AIContextBuilderService } from './ai-context-builder-enhanced.service';
import { AIResponseService } from './ai-response.service';
import { AIHealthSafetyService } from './ai-safety.service';
import { AIPromptBuilder } from './prompts';
import { OpenAIProvider } from './providers/openai.provider';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AIDeduplicationService } from './ai-deduplication.service';
import { AIFeedbackService } from './ai-feedback.service';
import { AIConversationService } from './ai-conversation.service';
import { AIAnalyticsService } from './ai-analytics.service';
import { AINotificationService } from './ai-notification.service';
import { HealthTrendsModule } from '../health-trends/health-trends.module';
import { AIHistoryModule } from '../ai-history/ai-history.module';
import { AILoggingModule } from '../ai-logging/ai-logging.module';
import { AICacheModule } from '../ai-cache/ai-cache.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DonationEligibilityModule } from '../donation-eligibility/donation-eligibility.module';

@Module({
  imports: [
    ConfigModule,
    HealthTrendsModule,
    AIHistoryModule,
    AILoggingModule,
    AICacheModule,
    AuditLogsModule,
    NotificationsModule,
    DonationEligibilityModule,
  ],
  controllers: [AIHealthController, AIAdminController],
  providers: [
    AIHealthService,
    AIContextBuilder,
    AIContextBuilderService,
    AIResponseService,
    AIHealthSafetyService,
    AIPromptBuilder,
    OpenAIProvider,
    AIProviderFactory,
    AIDeduplicationService,
    AIFeedbackService,
    AIConversationService,
    AIAnalyticsService,
    AINotificationService,
  ],
  exports: [AIHealthService, AINotificationService],
})
export class AIHealthModule {}
