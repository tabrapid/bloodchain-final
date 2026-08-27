import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './services/notifications.service';
import { PushDeviceService } from './services/push-device.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import {
  CreateNotificationDto,
  NotificationFilterDto,
  MarkReadDto,
  RegisterPushDeviceDto,
  UpdatePushDeviceDto,
  UpdateNotificationPreferencesDto,
} from './dto';
import { WrapResponseInterceptor } from '../../common/interceptors/wrap-response.interceptor';

@Controller('notifications')
@UseInterceptors(WrapResponseInterceptor)
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  @Get()
  async findAll(@Query() filter: NotificationFilterDto, @CurrentUser('sub') userId: string) {
    return this.notificationsService.findAll(filter, userId);
  }

  @Get('stats')
  async getStats(@CurrentUser('sub') userId: string) {
    return this.notificationsService.getStats(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    return { count: await this.notificationsService.getUnreadCount(userId) };
  }

  // Must be registered before the catch-all @Get(':id') below -- a
  // single-segment literal route needs to win before a route param at the
  // same depth, or GET /notifications/preferences resolves as findOne('preferences').
  @Get('preferences')
  async getPreferences(@CurrentUser('sub') userId: string) {
    return this.preferenceService.getPreferences(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  @Post('mark-read')
  async markAllRead(@Body() dto: MarkReadDto, @CurrentUser('sub') userId: string) {
    await Promise.all(
      dto.notificationIds.map(id => this.notificationsService.markAsRead(id, userId)),
    );
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch(':id/unread')
  async markAsUnread(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.markAsUnread(id, userId);
  }

  @Patch('mark-all-read')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.archive(id, userId);
  }

  @Patch(':id/unarchive')
  async unarchive(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.unarchive(id, userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.delete(id, userId);
  }

  @Post('devices/register')
  async registerDevice(@Body() dto: RegisterPushDeviceDto, @CurrentUser('sub') userId: string) {
    return this.pushDeviceService.register(userId, dto);
  }

  @Patch('devices/:id')
  async updateDevice(@Param('id') id: string, @Body() dto: UpdatePushDeviceDto) {
    return this.pushDeviceService.update(id, dto);
  }

  @Post('devices/:id/deactivate')
  async deactivateDevice(@Param('id') id: string) {
    return this.pushDeviceService.deactivate(id);
  }

  @Post('devices/deactivate-all')
  async deactivateAllDevices(@CurrentUser('sub') userId: string) {
    return this.pushDeviceService.removeForUser(userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return {
      data: await this.preferenceService.updatePreferences(
        userId,
        dto,
        req.headers['x-forwarded-for'] as string,
      ),
    };
  }
}
