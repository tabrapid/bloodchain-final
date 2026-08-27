import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ensureGamificationProfileRow } from './gamification-profile.util';
import { XP_CONFIG, LEVEL_CONFIG } from '../config/gamification.config';
import { XpTransactionType } from '@prisma/client';

@Injectable()
export class XpService {
  constructor(private readonly db: PrismaService) {}

  async getXpTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ transactions: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.db.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.xpTransaction.count({ where: { userId } }),
    ]);

    return { transactions, total };
  }

  async awardXp(
    userId: string,
    amount: number,
    type: XpTransactionType,
    sourceType: string,
    sourceId: string,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; newTotal: number; transactionId: string }> {
    const existingTx = await this.db.xpTransaction.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
    });

    if (existingTx) {
      return { success: false, newTotal: 0, transactionId: existingTx.id };
    }

    // Guarantee the profile row exists before the transaction, so the upsert
    // inside it always takes its update branch. Without this, two concurrent
    // awards for a user with no profile yet race on the insert (see
    // ensureGamificationProfileRow).
    await ensureGamificationProfileRow(this.db, userId);

    const result = await this.db.$transaction(async (tx) => {
      const transaction = await tx.xpTransaction.create({
        data: {
          userId,
          amount,
          type,
          sourceType,
          sourceId,
          description,
          metadata: metadata || undefined,
        },
      });

      const profile = await tx.gamificationProfile.upsert({
        where: { userId },
        create: { userId, totalXp: amount, level: 1 },
        update: { totalXp: { increment: amount } },
      });

      return { transaction, newTotal: profile.totalXp };
    });

    return {
      success: true,
      newTotal: result.newTotal,
      transactionId: result.transaction.id,
    };
  }

  async awardDonationXp(
    userId: string,
    donationId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const result = await this.awardXp(
      userId,
      XP_CONFIG.DONATION_COMPLETED,
      XpTransactionType.DONATION_COMPLETED,
      'DONATION',
      donationId,
      'Blood donation completed',
    );
    return { ...result, xpAmount: XP_CONFIG.DONATION_COMPLETED };
  }

  async awardEmergencyDonationXp(
    userId: string,
    donationId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const result = await this.awardXp(
      userId,
      XP_CONFIG.EMERGENCY_DONATION_COMPLETED,
      XpTransactionType.EMERGENCY_DONATION_COMPLETED,
      'EMERGENCY_DONATION',
      donationId,
      'Emergency blood donation completed',
    );
    return { ...result, xpAmount: XP_CONFIG.EMERGENCY_DONATION_COMPLETED };
  }

  async awardBloodTestXp(
    userId: string,
    resultId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const result = await this.awardXp(
      userId,
      XP_CONFIG.BLOOD_TEST_COMPLETED,
      XpTransactionType.BLOOD_TEST_COMPLETED,
      'BLOOD_TEST',
      resultId,
      'Blood test completed',
    );
    return { ...result, xpAmount: XP_CONFIG.BLOOD_TEST_COMPLETED };
  }

  async awardAppointmentXp(
    userId: string,
    appointmentId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const result = await this.awardXp(
      userId,
      XP_CONFIG.APPOINTMENT_COMPLETED,
      XpTransactionType.APPOINTMENT_COMPLETED,
      'APPOINTMENT',
      appointmentId,
      'Appointment completed',
    );
    return { ...result, xpAmount: XP_CONFIG.APPOINTMENT_COMPLETED };
  }

  async awardProfileCompletionXp(
    userId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const existingTx = await this.db.xpTransaction.findFirst({
      where: { userId, type: XpTransactionType.PROFILE_COMPLETED },
    });

    if (existingTx) {
      return { success: false, newTotal: 0, xpAmount: 0 };
    }

    const result = await this.awardXp(
      userId,
      XP_CONFIG.PROFILE_COMPLETED,
      XpTransactionType.PROFILE_COMPLETED,
      'PROFILE',
      userId,
      'Profile completed',
    );
    return { ...result, xpAmount: XP_CONFIG.PROFILE_COMPLETED };
  }

  async awardAchievementXp(
    userId: string,
    achievementCode: string,
    xpReward: number,
  ): Promise<{ success: boolean; newTotal: number }> {
    return this.awardXp(
      userId,
      xpReward,
      XpTransactionType.ACHIEVEMENT_UNLOCKED,
      'ACHIEVEMENT',
      achievementCode,
      `Achievement unlocked: ${achievementCode}`,
    );
  }

  async awardEmergencyResponseXp(
    userId: string,
    responseId: string,
  ): Promise<{ success: boolean; newTotal: number; xpAmount: number }> {
    const result = await this.awardXp(
      userId,
      XP_CONFIG.EMERGENCY_RESPONSE_ACCEPTED,
      XpTransactionType.EMERGENCY_RESPONSE_ACCEPTED,
      'EMERGENCY_RESPONSE',
      responseId,
      'Emergency response accepted',
    );
    return { ...result, xpAmount: XP_CONFIG.EMERGENCY_RESPONSE_ACCEPTED };
  }

  async createAdminAdjustment(
    userId: string,
    adminId: string,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; newTotal: number }> {
    // Guarantee the profile row exists before the transaction, so the upsert
    // inside it always takes its update branch. Without this, two concurrent
    // awards for a user with no profile yet race on the insert (see
    // ensureGamificationProfileRow).
    await ensureGamificationProfileRow(this.db, userId);

    const result = await this.db.$transaction(async (tx) => {
      const transaction = await tx.xpTransaction.create({
        data: {
          userId,
          amount,
          type: XpTransactionType.ADMIN_ADJUSTMENT,
          sourceType: 'ADMIN',
          sourceId: adminId,
          description: `Admin adjustment: ${reason}`,
          metadata: { adminId, reason },
        },
      });

      const profile = await tx.gamificationProfile.upsert({
        where: { userId },
        create: { userId, totalXp: Math.max(0, amount), level: 1 },
        update: { totalXp: { increment: amount } },
      });

      const newTotal = Math.max(0, profile.totalXp);

      if (profile.totalXp !== newTotal) {
        await tx.gamificationProfile.update({
          where: { userId },
          data: { totalXp: newTotal },
        });
      }

      return { transaction, newTotal };
    });

    return { success: true, newTotal: result.newTotal };
  }

  async getTotalXp(userId: string): Promise<number> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });
    return profile?.totalXp || 0;
  }

  async ensureProfileExists(userId: string): Promise<void> {
    await ensureGamificationProfileRow(this.db, userId);
  }
}
