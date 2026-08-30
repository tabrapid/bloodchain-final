import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/services/notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType } from '@prisma/client';
import { NotificationType, NotificationPriority } from '../notifications/dto';

@Injectable()
export class AINotificationService {
  private readonly logger = new Logger(AINotificationService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyInsightReady(userId: string, insightType: AIInsightType, sourceId?: string) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (preference && !preference.healthResults) {
      this.logger.debug(`User ${userId} has disabled health result notifications`);
      return;
    }

    const titles: Record<string, string> = {
      TREND_SUMMARY: 'AI Trend Analysis Ready',
      RESULT_EXPLANATION: 'AI Result Analysis Ready',
      HEALTH_SUMMARY: 'Your AI Health Summary',
      DONATION_INSIGHT: 'AI Donation Insights Available',
      APPOINTMENT_INSIGHT: 'AI Appointment Summary Ready',
      WEEKLY_SUMMARY: 'Weekly AI Health Summary',
    };

    const title = titles[insightType] || 'New AI Insight Available';

    await this.notificationsService.create({
      recipientId: userId,
      type: NotificationType.AI,
      priority: NotificationPriority.NORMAL,
      title,
      body: 'A new AI-generated health insight is ready to view.',
      data: {
        insightType,
        sourceId,
      },
      // `deepLink` must be a top-level field (see CreateNotificationDto) --
      // nesting it inside `data` means the mobile app's notification tap
      // handler, which reads `notification.deepLink`, never sees it.
      deepLink: '/(app)/insights',
    });

    this.logger.log(`AI notification sent to user ${userId}: ${title}`);
  }

  async notifyAnalysisComplete(userId: string, success: boolean, insightType?: string) {
    if (!success) {
      await this.notificationsService.create({
        recipientId: userId,
        type: NotificationType.AI,
        priority: NotificationPriority.NORMAL,
        title: 'AI Analysis Unavailable',
        body: 'AI analysis is temporarily unavailable. Please try again later.',
        data: {
          insightType,
        },
        deepLink: '/(app)/insights',
      });
    }
  }
}
