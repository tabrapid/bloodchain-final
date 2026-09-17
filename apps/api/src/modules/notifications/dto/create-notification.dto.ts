import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';
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

/**
 * The query behind a donor's notification inbox.
 *
 * This was an `interface`, which the global ValidationPipe cannot transform or
 * validate -- so `@Query()` handed the service raw strings and
 * `?limit=5` produced `take: "5" + 1`, i.e. `"51"`, which Prisma refuses:
 * every request that named a page size answered 500 and the inbox was empty
 * for any client that paginates. `isRead` had the same shape of problem from
 * the other direction: `?isRead=false` is a non-empty string, so it read as
 * `true` and showed the donor their read notifications when they asked for
 * their unread ones. A class with the repo's own strict boolean decorator
 * fixes both, and rejects nonsense rather than guessing at it.
 *
 * There is deliberately no `recipientId` here. `findAll` has always taken the
 * recipient from the caller's token and ignored any on the filter; declaring
 * it would both suggest a client could ask for someone else's inbox and, with
 * `forbidNonWhitelisted`, make every request 400 on a property nobody sent.
 */
export class NotificationFilterDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @OptionalBooleanField('Only read notifications, or only unread ones')
  isRead?: boolean;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'The id of the last item on the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Narrow to the notifications raised by one thing -- one appointment, one
   * SOS request. `NotificationEventHandler` was already passing these, cast
   * through `as any` because the filter had no such fields; `findAll` ignored
   * them, so "expire the notifications for this expired SOS request" expired
   * every unexpired notification that donor had, appointment reminders
   * included.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;
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
