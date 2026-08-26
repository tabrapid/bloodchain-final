import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CampaignStatus } from '@prisma/client';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCampaign(organizationId: string, dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        bloodGroupsNeeded: dto.bloodGroupsNeeded || [],
        targetParticipants: dto.targetParticipants,
        status: CampaignStatus.DRAFT,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return campaign;
  }

  async updateCampaign(
    campaignId: string,
    organizationId: string,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.organizationId !== organizationId) {
      throw new ForbiddenException('You can only update campaigns from your organization');
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        bloodGroupsNeeded: dto.bloodGroupsNeeded,
        targetParticipants: dto.targetParticipants,
        status: dto.status,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  async getCampaigns(
    page: number = 1,
    limit: number = 20,
    status?: CampaignStatus,
    organizationId?: string,
  ) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          participants: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    const itemsWithCount = items.map((campaign) => ({
      ...campaign,
      participantCount: campaign.participants.length,
    }));

    return {
      items: itemsWithCount,
      total,
      page,
      limit,
    };
  }

  async getCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return {
      ...campaign,
      participantCount: campaign.participants.length,
    };
  }

  async joinCampaign(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.ACTIVE && campaign.status !== CampaignStatus.PUBLISHED) {
      throw new BadRequestException('Campaign is not active');
    }

    const existingParticipant = await this.prisma.campaignParticipant.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId,
        },
      },
    });

    if (existingParticipant) {
      return existingParticipant;
    }

    const participant = await this.prisma.campaignParticipant.create({
      data: {
        campaignId,
        userId,
        status: 'JOINED',
      },
    });

    return participant;
  }

  async leaveCampaign(campaignId: string, userId: string) {
    const participant = await this.prisma.campaignParticipant.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('You are not participating in this campaign');
    }

    await this.prisma.campaignParticipant.delete({
      where: {
        campaignId_userId: {
          campaignId,
          userId,
        },
      },
    });

    return { success: true };
  }

  async getUserCampaigns(userId: string, page: number = 1, limit: number = 20) {
    const [items, total] = await Promise.all([
      this.prisma.campaignParticipant.findMany({
        where: { userId },
        include: {
          campaign: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.campaignParticipant.count({
        where: { userId },
      }),
    ]);

    return {
      items: items.map((p) => ({
        ...p.campaign,
        joinedAt: p.joinedAt,
        participantStatus: p.status,
      })),
      total,
      page,
      limit,
    };
  }
}
