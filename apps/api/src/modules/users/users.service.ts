import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async findById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        phone: true,
        dateOfBirth: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findMany(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.db.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
        },
      }),
      this.db.user.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        notificationPreference: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        donorProfile: user.donorProfile
          ? {
              id: user.donorProfile.id,
              bloodType: user.donorProfile.bloodType,
              rhFactor: user.donorProfile.rhFactor,
              bloodTypeVerifiedAt: user.donorProfile.bloodTypeVerifiedAt,
              bloodTypeSource: user.donorProfile.bloodTypeSource,
              city: user.donorProfile.city,
              district: user.donorProfile.district,
              donorStatus: user.donorProfile.donorStatus,
              verificationStatus: user.donorProfile.verificationStatus,
              dateOfBirth: user.donorProfile.dateOfBirth,
              consentLocation: user.donorProfile.consentLocation,
            }
          : null,
        notificationPreference: user.notificationPreference
          ? {
              id: user.notificationPreference.id,
              emergencyRequests: user.notificationPreference.emergencyRequests,
              appointments: user.notificationPreference.appointments,
              donationReminders: user.notificationPreference.donationReminders,
              healthResults: user.notificationPreference.healthResults,
              system: user.notificationPreference.system,
              gamification: user.notificationPreference.gamification,
              bloodRequests: user.notificationPreference.bloodRequests,
              shipments: user.notificationPreference.shipments,
              inventory: user.notificationPreference.inventory,
              security: user.notificationPreference.security,
            }
          : null,
      },
    };
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      phone?: string;
      dateOfBirth?: Date;
    },
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        displayName: data.displayName ?? user.displayName,
        phone: data.phone ?? user.phone,
        dateOfBirth: data.dateOfBirth ?? user.dateOfBirth,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return {
      data: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        phone: updated.phone,
        dateOfBirth: updated.dateOfBirth,
        status: updated.status,
        emailVerified: updated.emailVerified,
        phoneVerified: updated.phoneVerified,
      },
    };
  }
}