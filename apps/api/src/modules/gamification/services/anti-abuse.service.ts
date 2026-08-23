import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AntiAbuseService {
  constructor(private readonly db: PrismaService) {}

  async isDuplicateXpTransaction(
    sourceType: string,
    sourceId: string,
  ): Promise<boolean> {
    const existing = await this.db.xpTransaction.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
    });
    return !!existing;
  }

  async checkDonationFrequency(
    userId: string,
    maxDonationsPerMonth = 4,
  ): Promise<{ allowed: boolean; recentCount: number }> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const recentCount = await this.db.donation.count({
      where: {
        donorId: userId,
        status: 'COMPLETED',
        completedAt: { gte: oneMonthAgo },
      },
    });

    return {
      allowed: recentCount < maxDonationsPerMonth,
      recentCount,
    };
  }

  async checkForDuplicateDonation(
    userId: string,
    appointmentId: string,
  ): Promise<boolean> {
    const existing = await this.db.xpTransaction.findFirst({
      where: {
        userId,
        sourceType: 'DONATION',
        sourceId: appointmentId,
      },
    });
    return !!existing;
  }

  async checkXpTransactionLimit(
    userId: string,
    maxTransactionsPerHour = 10,
  ): Promise<{ allowed: boolean; recentCount: number }> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentCount = await this.db.xpTransaction.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
        type: { not: 'ADMIN_ADJUSTMENT' },
      },
    });

    return {
      allowed: recentCount < maxTransactionsPerHour,
      recentCount,
    };
  }

  async detectRapidXpGains(userId: string): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentTransactions = await this.db.xpTransaction.findMany({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
        type: { not: 'ADMIN_ADJUSTMENT' },
      },
    });

    const totalXp = recentTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    if (totalXp > 200) {
      return { suspicious: true, reason: 'Excessive XP gained in short period' };
    }

    if (recentTransactions.length > 5) {
      const donationTxs = recentTransactions.filter(
        (tx) => tx.type === 'DONATION_COMPLETED' || tx.type === 'EMERGENCY_DONATION_COMPLETED',
      );

      if (donationTxs.length > 2) {
        return { suspicious: true, reason: 'Multiple donation XP awards in short period' };
      }
    }

    return { suspicious: false };
  }

  async verifyDonationCompletion(donationId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      return { valid: false, reason: 'Donation not found' };
    }

    if (donation.status !== 'COMPLETED') {
      return { valid: false, reason: 'Donation not completed' };
    }

    if (!donation.completedAt) {
      return { valid: false, reason: 'Donation completion not verified' };
    }

    return { valid: true };
  }

  async verifyEmergencyResponseCompletion(responseId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return { valid: false, reason: 'Emergency response not found' };
    }

    if (response.status !== 'COMPLETED') {
      return { valid: false, reason: 'Emergency response not completed' };
    }

    return { valid: true };
  }

  async verifyBloodTestCompletion(resultId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const result = await this.db.laboratoryResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      return { valid: false, reason: 'Blood test result not found' };
    }

    if (result.status !== 'PUBLISHED') {
      return { valid: false, reason: 'Blood test not published' };
    }

    return { valid: true };
  }

  async verifyAppointmentCompletion(appointmentId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return { valid: false, reason: 'Appointment not found' };
    }

    if (appointment.status !== 'COMPLETED') {
      return { valid: false, reason: 'Appointment not completed' };
    }

    return { valid: true };
  }
}
