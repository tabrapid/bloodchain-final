import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ensureGamificationProfileRow } from './gamification-profile.util';
import { ReputationType } from '@prisma/client';

@Injectable()
export class ReputationService {
  constructor(private readonly db: PrismaService) {}

  async getReputationScore(userId: string): Promise<number> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });
    return profile?.reputationScore || 0;
  }

  async awardReputation(
    userId: string,
    amount: number,
    type: ReputationType,
    sourceType: string,
    sourceId: string,
    reason: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; newScore: number }> {
    // Guarantee the profile row exists before the transaction, so the upsert
    // inside it always takes its update branch. Without this, two concurrent
    // awards for a user with no profile yet race on the insert (see
    // ensureGamificationProfileRow).
    await ensureGamificationProfileRow(this.db, userId);

    const result = await this.db.$transaction(async (tx) => {
      await tx.reputationTransaction.create({
        data: {
          userId,
          amount,
          type,
          sourceType,
          sourceId,
          reason,
          metadata: metadata || undefined,
        },
      });

      const profile = await tx.gamificationProfile.upsert({
        where: { userId },
        create: { userId, totalXp: 0, level: 1, reputationScore: Math.max(0, amount) },
        update: { reputationScore: { increment: amount } },
      });

      return { newScore: Math.max(0, profile.reputationScore) };
    });

    return { success: true, newScore: result.newScore };
  }

  async awardVerifiedContributionReputation(
    userId: string,
    donationId: string,
  ): Promise<{ success: boolean; newScore: number }> {
    return this.awardReputation(
      userId,
      10,
      ReputationType.VERIFIED_CONTRIBUTION,
      'DONATION',
      donationId,
      'Verified blood donation',
    );
  }

  async awardEmergencyResponseReputation(
    userId: string,
    responseId: string,
  ): Promise<{ success: boolean; newScore: number }> {
    return this.awardReputation(
      userId,
      15,
      ReputationType.EMERGENCY_RESPONSE,
      'EMERGENCY_RESPONSE',
      responseId,
      'Successful emergency response',
    );
  }

  async awardAppointmentAttendanceReputation(
    userId: string,
    appointmentId: string,
  ): Promise<{ success: boolean; newScore: number }> {
    return this.awardReputation(
      userId,
      5,
      ReputationType.APPOINTMENT_ATTENDANCE,
      'APPOINTMENT',
      appointmentId,
      'Completed appointment',
    );
  }

  async createAdminReputationAdjustment(
    userId: string,
    adminId: string,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; newScore: number }> {
    // Guarantee the profile row exists before the transaction, so the upsert
    // inside it always takes its update branch. Without this, two concurrent
    // awards for a user with no profile yet race on the insert (see
    // ensureGamificationProfileRow).
    await ensureGamificationProfileRow(this.db, userId);

    const result = await this.db.$transaction(async (tx) => {
      await tx.reputationTransaction.create({
        data: {
          userId,
          amount,
          type: ReputationType.ADMIN_ADJUSTMENT,
          sourceType: 'ADMIN',
          sourceId: adminId,
          reason: `Admin adjustment: ${reason}`,
          metadata: { adminId, reason },
        },
      });

      const profile = await tx.gamificationProfile.upsert({
        where: { userId },
        create: { userId, totalXp: 0, level: 1, reputationScore: Math.max(0, amount) },
        update: { reputationScore: { increment: amount } },
      });

      return { newScore: Math.max(0, profile.reputationScore) };
    });

    return { success: true, newScore: result.newScore };
  }

  async getReputationHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ transactions: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.db.reputationTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.reputationTransaction.count({ where: { userId } }),
    ]);

    return { transactions, total };
  }

  async getReputationLevel(score: number): Promise<{
    level: string;
    levelNumber: number;
    minScore: number;
    maxScore: number;
  }> {
    const levels = [
      { level: 'New', levelNumber: 1, minScore: 0, maxScore: 49 },
      { level: 'Trusted Contributor', levelNumber: 2, minScore: 50, maxScore: 149 },
      { level: 'Community Contributor', levelNumber: 3, minScore: 150, maxScore: 299 },
      { level: 'Reliable Donor', levelNumber: 4, minScore: 300, maxScore: 499 },
      { level: 'Community Champion', levelNumber: 5, minScore: 500, maxScore: Infinity },
    ];

    const reputation = levels.find((l) => score >= l.minScore && score <= l.maxScore) ?? levels[0]!;

    return reputation;
  }
}
