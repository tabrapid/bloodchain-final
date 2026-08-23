import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChallengeType, ChallengeStatus, ChallengeVisibility } from '@prisma/client';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/challenges.dto';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async createChallenge(dto: CreateChallengeDto, createdBy: string) {
    const challenge = await this.prisma.challenge.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        visibility: dto.visibility || ChallengeVisibility.PUBLIC,
        organizationId: dto.organizationId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        goal: dto.goal || 1,
        xpReward: dto.xpReward || 0,
        badgeId: dto.badgeId,
        createdBy,
        status: ChallengeStatus.DRAFT,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    return challenge;
  }

  async updateChallenge(challengeId: string, dto: UpdateChallengeDto) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    const updated = await this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        goal: dto.goal,
        xpReward: dto.xpReward,
        badgeId: dto.badgeId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    return updated;
  }

  async getChallenges(
    page: number = 1,
    limit: number = 20,
    type?: ChallengeType,
    status?: ChallengeStatus,
    visibility?: ChallengeVisibility,
  ) {
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (visibility) {
      where.visibility = visibility;
    }

    const [items, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          badge: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
          participants: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.challenge.count({ where }),
    ]);

    const itemsWithCount = items.map((challenge) => ({
      ...challenge,
      participantCount: challenge.participants.length,
    }));

    return {
      items: itemsWithCount,
      total,
      page,
      limit,
    };
  }

  async getChallenge(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
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
          orderBy: { progress: 'desc' },
          take: 10,
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    return {
      ...challenge,
      participantCount: challenge.participants.length,
    };
  }

  async joinChallenge(challengeId: string, userId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    if (challenge.status !== ChallengeStatus.ACTIVE) {
      throw new BadRequestException('Challenge is not active');
    }

    const existingParticipant = await this.prisma.challengeParticipant.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });

    if (existingParticipant) {
      return existingParticipant;
    }

    const participant = await this.prisma.challengeParticipant.create({
      data: {
        challengeId,
        userId,
        progress: 0,
      },
    });

    return participant;
  }

  async updateProgress(challengeId: string, userId: string, progress: number) {
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('You are not participating in this challenge');
    }

    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    const completedAt = progress >= challenge.goal ? new Date() : null;

    const updated = await this.prisma.challengeParticipant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        progress,
        completedAt,
      },
    });

    return updated;
  }

  async getUserChallenges(userId: string, page: number = 1, limit: number = 20) {
    const [items, total] = await Promise.all([
      this.prisma.challengeParticipant.findMany({
        where: { userId },
        include: {
          challenge: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
              badge: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.challengeParticipant.count({
        where: { userId },
      }),
    ]);

    return {
      items: items.map((p) => ({
        ...p.challenge,
        userProgress: p.progress,
        completedAt: p.completedAt,
        joinedAt: p.joinedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getActiveChallenges(userId: string) {
    const challenges = await this.prisma.challenge.findMany({
      where: {
        status: ChallengeStatus.ACTIVE,
        visibility: ChallengeVisibility.PUBLIC,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
        participants: {
          where: { userId },
          select: {
            progress: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return challenges.map((challenge) => ({
      ...challenge,
      userProgress: challenge.participants[0]?.progress || 0,
      completedAt: challenge.participants[0]?.completedAt || null,
      participantCount: challenge.participants.length,
    }));
  }
}
