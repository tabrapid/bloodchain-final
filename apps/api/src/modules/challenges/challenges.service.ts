import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ChallengeType,
  ChallengeStatus,
  ChallengeVisibility,
  DonationStatus,
  AppointmentStatus,
  EducationProgressStatus,
  CommunityPostStatus,
  Challenge,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CHALLENGE_COMPLETED_EVENT } from '../gamification/events/gamification-event.handler';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/challenges.dto';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

  /**
   * Recomputes a participant's progress from their real activity records -
   * the client never supplies a progress number (it used to accept one
   * directly, which let any donor max any challenge instantly).
   */
  async recalculateProgress(challengeId: string, userId: string) {
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

    const progress = await this.computeProgress(challenge, userId);
    const alreadyCompleted = !!participant.completedAt;
    const nowCompletes = !alreadyCompleted && progress >= challenge.goal;

    const updated = await this.prisma.challengeParticipant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        progress,
        completedAt: alreadyCompleted ? participant.completedAt : nowCompletes ? new Date() : null,
      },
    });

    if (nowCompletes && challenge.xpReward > 0) {
      this.eventEmitter.emit(CHALLENGE_COMPLETED_EVENT, {
        challengeId,
        userId,
        xpAmount: challenge.xpReward,
        challengeTitle: challenge.title,
      });
    }

    return updated;
  }

  /** Recalculates progress for every ACTIVE, not-yet-completed challenge of the given type(s) this user has joined. */
  async recalculateProgressForTypes(userId: string, types: ChallengeType[]): Promise<void> {
    const participants = await this.prisma.challengeParticipant.findMany({
      where: {
        userId,
        completedAt: null,
        challenge: { type: { in: types }, status: ChallengeStatus.ACTIVE },
      },
      select: { challengeId: true },
    });

    for (const participant of participants) {
      await this.recalculateProgress(participant.challengeId, userId);
    }
  }

  private async computeProgress(
    challenge: Pick<Challenge, 'type' | 'startDate' | 'endDate'>,
    userId: string,
  ): Promise<number> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (challenge.startDate) dateFilter.gte = challenge.startDate;
    if (challenge.endDate) dateFilter.lte = challenge.endDate;
    const window = Object.keys(dateFilter).length > 0 ? dateFilter : undefined;

    switch (challenge.type) {
      case ChallengeType.DONATION_MILESTONE:
        return this.prisma.donation.count({
          where: {
            donorId: userId,
            status: DonationStatus.COMPLETED,
            ...(window ? { completedAt: window } : {}),
          },
        });

      case ChallengeType.APPOINTMENT_COMPLETION:
        return this.prisma.appointment.count({
          where: {
            donorId: userId,
            status: AppointmentStatus.COMPLETED,
            ...(window ? { completedAt: window } : {}),
          },
        });

      case ChallengeType.CAMPAIGN_PARTICIPATION:
        return this.prisma.campaignParticipant.count({
          where: {
            userId,
            ...(window ? { joinedAt: window } : {}),
          },
        });

      case ChallengeType.EDUCATION:
        return this.prisma.educationProgress.count({
          where: {
            userId,
            status: EducationProgressStatus.COMPLETED,
            ...(window ? { completedAt: window } : {}),
          },
        });

      case ChallengeType.COMMUNITY:
        return this.prisma.communityPost.count({
          where: {
            authorId: userId,
            status: CommunityPostStatus.PUBLISHED,
            ...(window ? { publishedAt: window } : {}),
          },
        });

      case ChallengeType.CONSISTENCY: {
        // "Consistency" counts distinct calendar months with at least one
        // completed donation, not a raw donation count - that's what
        // DONATION_MILESTONE already measures.
        const donations = await this.prisma.donation.findMany({
          where: {
            donorId: userId,
            status: DonationStatus.COMPLETED,
            ...(window ? { completedAt: window } : {}),
          },
          select: { completedAt: true },
        });
        const months = new Set(
          donations
            .filter((d): d is { completedAt: Date } => d.completedAt !== null)
            .map((d) => `${d.completedAt.getFullYear()}-${d.completedAt.getMonth()}`),
        );
        return months.size;
      }

      default:
        return 0;
    }
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
