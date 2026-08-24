import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HealthTrendsService } from '../health-trends/health-trends.service';

export interface DonationContext {
  totalDonations: number;
  lastDonationDate?: string;
  nextEligibleDate?: string;
  donationFrequency: string;
  bloodType?: string;
  recentDonations: Array<{
    date: string;
    type: string;
    volume?: number;
    status: string;
  }>;
}

export interface AppointmentContext {
  totalAppointments: number;
  completedAppointments: number;
  upcomingAppointments: Array<{
    id: string;
    date: string;
    type: string;
    organizationName: string;
    status: string;
  }>;
  noShowCount: number;
  completionRate: number;
}

export interface EnhancedHealthContext {
  userId: string;
  bloodTests: {
    total: number;
    lastTestDate?: string;
    parameters: Array<{
      code: string;
      name: string;
      latestValue?: number;
      unit?: string;
      trend?: string;
    }>;
  };
  donations: DonationContext;
  appointments: AppointmentContext;
  summary: string;
}

@Injectable()
export class AIContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthTrendsService: HealthTrendsService,
  ) {}

  async buildEnhancedContext(userId: string): Promise<EnhancedHealthContext> {
    const [donationContext, appointmentContext, bloodTestSummary] = await Promise.all([
      this.buildDonationContext(userId),
      this.buildAppointmentContext(userId),
      this.buildBloodTestContext(userId),
    ]);

    return {
      userId,
      bloodTests: bloodTestSummary,
      donations: donationContext,
      appointments: appointmentContext,
      summary: this.generateSummary(bloodTestSummary, donationContext, appointmentContext),
    };
  }

  private async buildDonationContext(userId: string): Promise<DonationContext> {
    const donations = await this.prisma.donation.findMany({
      where: { donorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        donationType: true,
        status: true,
        volumeMl: true,
        bloodType: true,
        rhFactor: true,
      },
    });

    const completedDonations = donations.filter((d) => d.status === 'COMPLETED');
    const lastDonation = completedDonations[0];

    // Calculate next eligible date (56 days after last donation for whole blood)
    let nextEligibleDate: string | undefined;
    if (lastDonation?.completedAt) {
      const lastDate = new Date(lastDonation.completedAt);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 56);
      nextEligibleDate = nextDate.toISOString();
    }

    // Calculate donation frequency
    let donationFrequency = 'Insufficient data';
    if (completedDonations.length >= 2) {
      const firstDonation = completedDonations[completedDonations.length - 1];
      const lastDate = new Date(lastDonation!.completedAt!);
      const firstDate = new Date(firstDonation!.completedAt!);
      const daysBetween = Math.floor(
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const avgDaysBetween = daysBetween / (completedDonations.length - 1);

      if (avgDaysBetween < 60) {
        donationFrequency = 'Regular donor';
      } else if (avgDaysBetween < 90) {
        donationFrequency = 'Occasional donor';
      } else {
        donationFrequency = 'Infrequent donor';
      }
    }

    return {
      totalDonations: completedDonations.length,
      lastDonationDate: lastDonation?.completedAt?.toISOString(),
      nextEligibleDate,
      donationFrequency,
      bloodType: lastDonation ? `${lastDonation.bloodType}${lastDonation.rhFactor}` : undefined,
      recentDonations: donations.slice(0, 5).map((d) => ({
        date: d.createdAt.toISOString(),
        type: d.donationType,
        volume: d.volumeMl || undefined,
        status: d.status,
      })),
    };
  }

  private async buildAppointmentContext(userId: string): Promise<AppointmentContext> {
    const appointments = await this.prisma.appointment.findMany({
      where: { donorId: userId },
      orderBy: { scheduledStart: 'desc' },
      take: 20,
      select: {
        id: true,
        scheduledStart: true,
        appointmentType: true,
        status: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    const completed = appointments.filter((a) => a.status === 'COMPLETED');
    const noShows = appointments.filter((a) => a.status === 'NO_SHOW');
    const upcoming = appointments
      .filter((a) => a.status === 'PENDING' && new Date(a.scheduledStart) > new Date())
      .slice(0, 5);

    const completionRate =
      appointments.length > 0 ? (completed.length / appointments.length) * 100 : 0;

    return {
      totalAppointments: appointments.length,
      completedAppointments: completed.length,
      upcomingAppointments: upcoming.map((a) => ({
        id: a.id,
        date: a.scheduledStart.toISOString(),
        type: a.appointmentType,
        organizationName: a.organization.name,
        status: a.status,
      })),
      noShowCount: noShows.length,
      completionRate: Math.round(completionRate),
    };
  }

  private async buildBloodTestContext(userId: string): Promise<{
    total: number;
    lastTestDate?: string;
    parameters: Array<{
      code: string;
      name: string;
      latestValue?: number;
      unit?: string;
      trend?: string;
    }>;
  }> {
    const results = await this.prisma.laboratoryResult.findMany({
      where: { donorId: userId, status: 'PUBLISHED' },
      orderBy: { performedAt: 'desc' },
      take: 10,
      include: {
        items: {
          include: {
            parameter: true,
          },
        },
      },
    });

    if (results.length === 0) {
      return {
        total: 0,
        parameters: [],
      };
    }

    // Get unique parameters with their latest values
    const parameterMap = new Map<
      string,
      {
        code: string;
        name: string;
        latestValue?: number;
        unit?: string;
        trend?: string;
      }
    >();

    for (const result of results) {
      for (const item of result.items) {
        if (!parameterMap.has(item.parameter.code)) {
          parameterMap.set(item.parameter.code, {
            code: item.parameter.code,
            name: item.parameter.name,
            latestValue: item.numericValue ? Number(item.numericValue) : undefined,
            unit: item.unit || undefined,
          });
        }
      }
    }

    return {
      total: results.length,
      lastTestDate: results[0]?.performedAt?.toISOString(),
      parameters: Array.from(parameterMap.values()).slice(0, 10),
    };
  }

  private generateSummary(
    bloodTests: { total: number; lastTestDate?: string },
    donations: DonationContext,
    appointments: AppointmentContext,
  ): string {
    const parts: string[] = [];

    if (bloodTests.total > 0) {
      parts.push(`${bloodTests.total} blood test${bloodTests.total > 1 ? 's' : ''} recorded`);
    }

    if (donations.totalDonations > 0) {
      parts.push(`${donations.totalDonations} donation${donations.totalDonations > 1 ? 's' : ''} completed`);
    }

    if (appointments.upcomingAppointments.length > 0) {
      parts.push(`${appointments.upcomingAppointments.length} upcoming appointment${appointments.upcomingAppointments.length > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'No health data available yet.';
    }

    return `Health profile: ${parts.join(', ')}.`;
  }
}
