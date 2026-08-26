import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommunityPostStatus, ContentReportStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let service: CommunityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      communityPost: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      contentReport: { findFirst: jest.fn(), create: jest.fn() },
      donation: { count: jest.fn() },
      appointment: { count: jest.fn() },
      campaignParticipant: { count: jest.fn() },
      challengeParticipant: { count: jest.fn() },
      educationProgress: { count: jest.fn() },
      gamificationProfile: { findUnique: jest.fn() },
      campaign: { count: jest.fn() },
      challenge: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  describe('getFeed', () => {
    it('only returns PUBLISHED posts', async () => {
      prisma.communityPost.findMany.mockResolvedValue([]);
      prisma.communityPost.count.mockResolvedValue(0);

      await service.getFeed('user-1', 1, 20);

      expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CommunityPostStatus.PUBLISHED } }),
      );
    });

    it('adds a type filter only when given', async () => {
      prisma.communityPost.findMany.mockResolvedValue([]);
      prisma.communityPost.count.mockResolvedValue(0);

      await service.getFeed('user-1', 1, 20, 'MILESTONE' as any);

      expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CommunityPostStatus.PUBLISHED, type: 'MILESTONE' },
        }),
      );
    });
  });

  describe('getPost', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      prisma.communityPost.findUnique.mockResolvedValue(null);

      await expect(service.getPost('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an unpublished post (does not leak drafts)', async () => {
      prisma.communityPost.findUnique.mockResolvedValue({ id: 'post-1', status: CommunityPostStatus.DRAFT });

      await expect(service.getPost('post-1')).rejects.toThrow(NotFoundException);
    });

    it('returns a published post', async () => {
      const post = { id: 'post-1', status: CommunityPostStatus.PUBLISHED };
      prisma.communityPost.findUnique.mockResolvedValue(post);

      expect(await service.getPost('post-1')).toBe(post);
    });
  });

  describe('reportContent', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      prisma.communityPost.findUnique.mockResolvedValue(null);

      await expect(service.reportContent('missing', 'user-1', 'SPAM')).rejects.toThrow(NotFoundException);
    });

    it('returns the existing report instead of creating a duplicate for a pending/reviewed report', async () => {
      prisma.communityPost.findUnique.mockResolvedValue({ id: 'post-1' });
      const existing = { id: 'report-1', status: ContentReportStatus.PENDING };
      prisma.contentReport.findFirst.mockResolvedValue(existing);

      const result = await service.reportContent('post-1', 'user-1', 'SPAM');

      expect(result).toBe(existing);
      expect(prisma.contentReport.create).not.toHaveBeenCalled();
    });

    it('creates a new PENDING report when none exists yet', async () => {
      prisma.communityPost.findUnique.mockResolvedValue({ id: 'post-1' });
      prisma.contentReport.findFirst.mockResolvedValue(null);
      prisma.contentReport.create.mockResolvedValue({});

      await service.reportContent('post-1', 'user-1', 'SPAM', 'looks fake');

      expect(prisma.contentReport.create).toHaveBeenCalledWith({
        data: {
          postId: 'post-1',
          reporterId: 'user-1',
          reason: 'SPAM',
          description: 'looks fake',
          status: ContentReportStatus.PENDING,
        },
      });
    });
  });

  describe('getImpactStats', () => {
    it('defaults xp/level/reputation when the user has no gamification profile yet', async () => {
      prisma.donation.count.mockResolvedValue(3);
      prisma.appointment.count.mockResolvedValue(3);
      prisma.campaignParticipant.count.mockResolvedValue(1);
      prisma.challengeParticipant.count.mockResolvedValue(0);
      prisma.educationProgress.count.mockResolvedValue(2);
      prisma.gamificationProfile.findUnique.mockResolvedValue(null);

      const result = await service.getImpactStats('user-1');

      expect(result).toEqual({
        donations: 3,
        appointments: 3,
        campaignParticipations: 1,
        challengeCompletions: 0,
        educationCompletions: 2,
        xp: 0,
        level: 1,
        reputation: 0,
      });
    });

    it('reflects the real gamification profile when present', async () => {
      prisma.donation.count.mockResolvedValue(0);
      prisma.appointment.count.mockResolvedValue(0);
      prisma.campaignParticipant.count.mockResolvedValue(0);
      prisma.challengeParticipant.count.mockResolvedValue(0);
      prisma.educationProgress.count.mockResolvedValue(0);
      prisma.gamificationProfile.findUnique.mockResolvedValue({
        totalXp: 500,
        level: 4,
        reputationScore: 12,
      });

      const result = await service.getImpactStats('user-1');

      expect(result).toEqual(
        expect.objectContaining({ xp: 500, level: 4, reputation: 12 }),
      );
    });
  });

  describe('getCommunityStats', () => {
    it('aggregates platform-wide counts', async () => {
      prisma.communityPost.count.mockResolvedValue(40);
      prisma.campaign.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
      prisma.challenge.count.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
      prisma.campaignParticipant.count.mockResolvedValue(120);

      const result = await service.getCommunityStats();

      expect(result).toEqual({
        posts: 40,
        campaigns: 10,
        challenges: 8,
        participants: 120,
        activeCampaigns: 3,
        activeChallenges: 2,
      });
    });
  });
});
