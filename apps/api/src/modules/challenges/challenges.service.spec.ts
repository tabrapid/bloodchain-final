import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { ChallengeStatus, ChallengeType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CHALLENGE_COMPLETED_EVENT } from '../gamification/events/gamification-event.handler';
import { ChallengesService } from './challenges.service';

function makeChallenge(overrides: Record<string, any> = {}) {
  return {
    id: 'chal-1',
    title: 'Donate 3 times',
    type: ChallengeType.DONATION_MILESTONE,
    status: ChallengeStatus.ACTIVE,
    goal: 3,
    xpReward: 50,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

describe('ChallengesService', () => {
  let service: ChallengesService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      challengeParticipant: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'part-1', ...data })),
        findMany: jest.fn(),
      },
      challenge: { findUnique: jest.fn() },
      donation: { count: jest.fn(), findMany: jest.fn() },
      appointment: { count: jest.fn() },
      campaignParticipant: { count: jest.fn() },
      educationProgress: { count: jest.fn() },
      communityPost: { count: jest.fn() },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ChallengesService>(ChallengesService);
  });

  describe('recalculateProgress', () => {
    it('throws NotFoundException when the user is not a participant', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue(null);

      await expect(service.recalculateProgress('chal-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the challenge no longer exists', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(null);

      await expect(service.recalculateProgress('chal-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('derives DONATION_MILESTONE progress from real completed donations, ignoring any client input', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 1, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ goal: 3 }));
      prisma.donation.count.mockResolvedValue(2);

      const result = await service.recalculateProgress('chal-1', 'user-1');

      expect(prisma.donation.count).toHaveBeenCalledWith({
        where: { donorId: 'user-1', status: 'COMPLETED' },
      });
      expect(prisma.challengeParticipant.update).toHaveBeenCalledWith({
        where: { challengeId_userId: { challengeId: 'chal-1', userId: 'user-1' } },
        data: { progress: 2, completedAt: null },
      });
      expect(result.progress).toBe(2);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('marks the challenge completed and emits the XP event the moment real progress reaches the goal', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 2, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ goal: 3, xpReward: 50 }));
      prisma.donation.count.mockResolvedValue(3);

      await service.recalculateProgress('chal-1', 'user-1');

      expect(prisma.challengeParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { progress: 3, completedAt: expect.any(Date) } }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(CHALLENGE_COMPLETED_EVENT, {
        challengeId: 'chal-1',
        userId: 'user-1',
        xpAmount: 50,
        challengeTitle: 'Donate 3 times',
      });
    });

    it('does not re-emit the XP event or move the completedAt timestamp once already completed', async () => {
      const originalCompletedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 3, completedAt: originalCompletedAt });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ goal: 3, xpReward: 50 }));
      prisma.donation.count.mockResolvedValue(5); // more donations happened after completion

      await service.recalculateProgress('chal-1', 'user-1');

      expect(prisma.challengeParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { progress: 5, completedAt: originalCompletedAt } }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does not emit an XP event for a challenge with no XP reward, even on completion', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 2, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ goal: 3, xpReward: 0 }));
      prisma.donation.count.mockResolvedValue(3);

      await service.recalculateProgress('chal-1', 'user-1');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('scopes the count to the challenge window when startDate/endDate are set', async () => {
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const endDate = new Date('2026-02-01T00:00:00.000Z');
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ startDate, endDate }));
      prisma.donation.count.mockResolvedValue(1);

      await service.recalculateProgress('chal-1', 'user-1');

      expect(prisma.donation.count).toHaveBeenCalledWith({
        where: {
          donorId: 'user-1',
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
        },
      });
    });

    it('derives APPOINTMENT_COMPLETION progress from completed appointments', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ type: ChallengeType.APPOINTMENT_COMPLETION }));
      prisma.appointment.count.mockResolvedValue(1);

      const result = await service.recalculateProgress('chal-1', 'user-1');

      expect(prisma.appointment.count).toHaveBeenCalledWith({
        where: { donorId: 'user-1', status: 'COMPLETED' },
      });
      expect(result.progress).toBe(1);
    });

    it('derives CAMPAIGN_PARTICIPATION progress from joined campaigns', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ type: ChallengeType.CAMPAIGN_PARTICIPATION }));
      prisma.campaignParticipant.count.mockResolvedValue(4);

      const result = await service.recalculateProgress('chal-1', 'user-1');
      expect(result.progress).toBe(4);
    });

    it('derives EDUCATION progress from completed education content', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ type: ChallengeType.EDUCATION }));
      prisma.educationProgress.count.mockResolvedValue(2);

      const result = await service.recalculateProgress('chal-1', 'user-1');
      expect(prisma.educationProgress.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'COMPLETED' },
      });
      expect(result.progress).toBe(2);
    });

    it('derives COMMUNITY progress from published posts', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ type: ChallengeType.COMMUNITY }));
      prisma.communityPost.count.mockResolvedValue(6);

      const result = await service.recalculateProgress('chal-1', 'user-1');
      expect(prisma.communityPost.count).toHaveBeenCalledWith({
        where: { authorId: 'user-1', status: 'PUBLISHED' },
      });
      expect(result.progress).toBe(6);
    });

    it('derives CONSISTENCY progress as the count of distinct months with a completed donation', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({ progress: 0, completedAt: null });
      prisma.challenge.findUnique.mockResolvedValue(makeChallenge({ type: ChallengeType.CONSISTENCY, goal: 2 }));
      prisma.donation.findMany.mockResolvedValue([
        { completedAt: new Date('2026-01-05') },
        { completedAt: new Date('2026-01-20') }, // same month as above - should not double count
        { completedAt: new Date('2026-02-10') },
        { completedAt: null }, // defensive: should be filtered out
      ]);

      const result = await service.recalculateProgress('chal-1', 'user-1');
      expect(result.progress).toBe(2);
    });
  });

  describe('recalculateProgressForTypes', () => {
    it('recalculates every ACTIVE, not-yet-completed participation of the matching type(s)', async () => {
      prisma.challengeParticipant.findMany.mockResolvedValue([{ challengeId: 'chal-1' }, { challengeId: 'chal-2' }]);
      prisma.challengeParticipant.findUnique
        .mockResolvedValueOnce({ progress: 0, completedAt: null })
        .mockResolvedValueOnce({ progress: 0, completedAt: null });
      prisma.challenge.findUnique
        .mockResolvedValueOnce(makeChallenge({ id: 'chal-1' }))
        .mockResolvedValueOnce(makeChallenge({ id: 'chal-2', title: 'Second' }));
      prisma.donation.count.mockResolvedValue(1);

      await service.recalculateProgressForTypes('user-1', [ChallengeType.DONATION_MILESTONE]);

      expect(prisma.challengeParticipant.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          completedAt: null,
          challenge: { type: { in: [ChallengeType.DONATION_MILESTONE] }, status: ChallengeStatus.ACTIVE },
        },
        select: { challengeId: true },
      });
      expect(prisma.challengeParticipant.update).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the user has no matching in-progress participations', async () => {
      prisma.challengeParticipant.findMany.mockResolvedValue([]);

      await service.recalculateProgressForTypes('user-1', [ChallengeType.DONATION_MILESTONE]);

      expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
    });
  });
});
