import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { NotificationType, NotificationPriority, NotificationStatus } from './notification.enums';

export interface CreateNotificationDto {
  recipientId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  deepLink?: string;
  expiresAt?: Date;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey?: string;
}

export interface NotificationFilterDto {
  recipientId?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  isRead?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  cursor?: string;
}

export interface UpdateNotificationDto {
  status?: NotificationStatus;
  readAt?: Date;
}

export class MarkReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  notificationIds!: string[];
}

export interface NotificationStatsDto {
  total: number;
  unread: number;
  byType: Record<string, number>;
}
