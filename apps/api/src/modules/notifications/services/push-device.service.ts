import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RegisterPushDeviceDto, UpdatePushDeviceDto } from '../dto';

@Injectable()
export class PushDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterPushDeviceDto) {
    const existing = await this.prisma.pushDevice.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      if (existing.userId !== userId) {
        await this.prisma.pushDevice.update({
          where: { id: existing.id },
          data: { userId, isActive: true, lastSeenAt: new Date() },
        });
        return this.prisma.pushDevice.findUnique({ where: { id: existing.id } });
      }

      return this.prisma.pushDevice.update({
        where: { id: existing.id },
        data: {
          userId,
          isActive: true,
          lastSeenAt: new Date(),
          locale: dto.locale,
          timezone: dto.timezone,
        },
      });
    }

    return this.prisma.pushDevice.create({
      data: {
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        locale: dto.locale || 'en',
        timezone: dto.timezone,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdatePushDeviceDto) {
    return this.prisma.pushDevice.update({
      where: { id },
      data: { ...dto, lastSeenAt: new Date() },
    });
  }

  async deactivate(id: string) {
    return this.prisma.pushDevice.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateByToken(token: string) {
    return this.prisma.pushDevice.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  async removeForUser(userId: string) {
    return this.prisma.pushDevice.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async getActiveDevicesForUser(userId: string) {
    return this.prisma.pushDevice.findMany({
      where: { userId, isActive: true },
    });
  }

  async markInvalidToken(token: string) {
    return this.prisma.pushDevice.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  async cleanupInactiveDevices(olderThanDays: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    return this.prisma.pushDevice.updateMany({
      where: {
        isActive: true,
        lastSeenAt: { lt: cutoff },
      },
      data: { isActive: false },
    });
  }
}
