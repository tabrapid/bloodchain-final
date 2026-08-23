import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateNotificationDto,
  NotificationFilterDto,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from '../dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    const existing = dto.idempotencyKey
      ? await this.prisma.notification.findUnique({
          where: { recipientId_idempotencyKey: { recipientId: dto.recipientId, idempotencyKey: dto.idempotencyKey } },
        })
      : null;

    if (existing) {
      return existing;
    }

    return this.prisma.notification.create({
      data: {
        recipientId: dto.recipientId,
        type: dto.type,
        priority: dto.priority || NotificationPriority.NORMAL,
        title: dto.title,
        body: dto.body,
        data: dto.data ? dto.data as any : undefined,
        deepLink: dto.deepLink,
        expiresAt: dto.expiresAt,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        idempotencyKey: dto.idempotencyKey,
        status: NotificationStatus.PENDING,
      },
    });
  }

  async findAll(filter: NotificationFilterDto, userId: string) {
    const where: any = { recipientId: userId };

    if (filter.type) where.type = filter.type;
    if (filter.priority) where.priority = filter.priority;
    if (filter.status) where.status = filter.status;
    if (filter.isRead !== undefined) {
      where.readAt = filter.isRead ? { not: null } : null;
    }
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: (filter.limit || 50) + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > (filter.limit || 50);
    const items = hasMore ? notifications.slice(0, -1) : notifications;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null;

    return { items, nextCursor };
  }

  async findOne(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: { deliveries: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return notification;
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.findOne(id, userId);

    if (notification.status !== NotificationStatus.READ) {
      return this.prisma.notification.update({
        where: { id },
        data: { status: NotificationStatus.READ, readAt: new Date() },
      });
    }

    return notification;
  }

  async markAsUnread(id: string, userId: string) {
    const notification = await this.findOne(id, userId);

    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, readAt: null },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
  }

  async getStats(userId: string) {
    const [total, unread, byTypeResult] = await Promise.all([
      this.prisma.notification.count({ where: { recipientId: userId } }),
      this.prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { recipientId: userId },
        _count: { id: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    byTypeResult.forEach((item: { type: string; _count: { id: number } }) => {
      byType[item.type] = item._count.id;
    });

    return { total, unread, byType };
  }

  async expireNotification(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.EXPIRED },
    });
  }

  async delete(id: string, userId: string) {
    const notification = await this.findOne(id, userId);

    if (notification.sourceType && ['LAB_RESULT', 'DONATION', 'APPOINTMENT'].includes(notification.sourceType)) {
      throw new ForbiddenException('Cannot delete notifications linked to medical records');
    }

    return this.prisma.notification.delete({ where: { id } });
  }
}
