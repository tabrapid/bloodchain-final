import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CommunityPostType,
  CommunityPostStatus,
  ContentReportReason,
  ContentReportStatus,
} from '@prisma/client';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: CommunityPostType,
  ) {
    const where: any = {
      status: CommunityPostStatus.PUBLISHED,
    };

    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          campaign: {
            select: {
              id: true,
              title: true,
            },
          },
          achievement: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communityPost.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getPost(postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        campaign: {
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            endDate: true,
          },
        },
        achievement: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            rarity: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== CommunityPostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async reportContent(
    postId: string,
    reporterId: string,
    reason: string,
    description?: string,
  ) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingReport = await this.prisma.contentReport.findFirst({
      where: {
        postId,
        reporterId,
        status: {
          in: [ContentReportStatus.PENDING, ContentReportStatus.REVIEWED],
        },
      },
    });

    if (existingReport) {
      return existingReport;
    }

    const report = await this.prisma.contentReport.create({
      data: {
        postId,
        reporterId,
        reason: reason as ContentReportReason,
        description,
        status: ContentReportStatus.PENDING,
      },
    });

    return report;
  }

  async getImpactStats(userId: string) {
    const [
      totalDonations,
      totalAppointments,
      campaignParticipations,
      challengeCompletions,
      educationCompletions,
    ] = await Promise.all([
      this.prisma.donation.count({
        where: {
          donorId: userId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.appointment.count({
        where: {
          donorId: userId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.campaignParticipant.count({
        where: { userId },
      }),
      this.prisma.challengeParticipant.count({
        where: {
          userId,
          completedAt: { not: null },
        },
      }),
      this.prisma.educationProgress.count({
        where: {
          userId,
          status: 'COMPLETED',
        },
      }),
    ]);

    const gamificationProfile = await this.prisma.gamificationProfile.findUnique({
      where: { userId },
      select: {
        totalXp: true,
        level: true,
        reputationScore: true,
      },
    });

    return {
      donations: totalDonations,
      appointments: totalAppointments,
      campaignParticipations,
      challengeCompletions,
      educationCompletions,
      xp: gamificationProfile?.totalXp || 0,
      level: gamificationProfile?.level || 1,
      reputation: gamificationProfile?.reputationScore || 0,
    };
  }

  async getCommunityStats() {
    const [
      totalPosts,
      totalCampaigns,
      totalChallenges,
      totalParticipants,
      activeCampaigns,
      activeChallenges,
    ] = await Promise.all([
      this.prisma.communityPost.count({
        where: { status: CommunityPostStatus.PUBLISHED },
      }),
      this.prisma.campaign.count(),
      this.prisma.challenge.count(),
      this.prisma.campaignParticipant.count(),
      this.prisma.campaign.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.challenge.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      posts: totalPosts,
      campaigns: totalCampaigns,
      challenges: totalChallenges,
      participants: totalParticipants,
      activeCampaigns,
      activeChallenges,
    };
  }
}
