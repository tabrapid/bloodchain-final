import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      campaign: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      campaignParticipant: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CampaignsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  describe('createCampaign', () => {
    it('always creates a new campaign in DRAFT status regardless of input', async () => {
      prisma.campaign.create.mockResolvedValue({});

      await service.createCampaign('org-1', {
        title: 'Blood drive',
        description: 'd',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      } as any);

      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.DRAFT, organizationId: 'org-1' }) }),
      );
    });

    it('defaults bloodGroupsNeeded to an empty array when omitted', async () => {
      prisma.campaign.create.mockResolvedValue({});

      await service.createCampaign('org-1', {
        title: 'Blood drive',
        description: 'd',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      } as any);

      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bloodGroupsNeeded: [] }) }),
      );
    });
  });

  describe('updateCampaign', () => {
    it('throws NotFoundException when the campaign does not exist', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.updateCampaign('missing', 'org-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the campaign belongs to a different organization', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', organizationId: 'org-2' });

      await expect(service.updateCampaign('c-1', 'org-1', {} as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('updates the campaign when it belongs to the calling organization', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', organizationId: 'org-1' });
      prisma.campaign.update.mockResolvedValue({ id: 'c-1', title: 'New title' });

      const result = await service.updateCampaign('c-1', 'org-1', { title: 'New title' } as any);

      expect(result.title).toBe('New title');
    });
  });

  describe('getCampaigns', () => {
    it('flattens participant count onto each campaign', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        { id: 'c-1', participants: [{ id: 'p-1' }, { id: 'p-2' }] },
      ]);
      prisma.campaign.count.mockResolvedValue(1);

      const result = await service.getCampaigns();

      expect(result.items[0]!.participantCount).toBe(2);
    });

    it('adds status/organizationId filters only when given', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);

      await service.getCampaigns(1, 20, CampaignStatus.ACTIVE, 'org-1');

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CampaignStatus.ACTIVE, organizationId: 'org-1' } }),
      );
    });
  });

  describe('getCampaign', () => {
    it('throws NotFoundException when missing', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getCampaign('missing')).rejects.toThrow(NotFoundException);
    });

    it('flattens the participant count onto the single campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', participants: [{ id: 'p-1' }] });

      const result = await service.getCampaign('c-1');

      expect(result.participantCount).toBe(1);
    });
  });

  describe('joinCampaign', () => {
    it('throws NotFoundException when the campaign does not exist', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.joinCampaign('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for a campaign that is neither ACTIVE nor PUBLISHED', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', status: CampaignStatus.DRAFT });

      await expect(service.joinCampaign('c-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('accepts an ACTIVE campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', status: CampaignStatus.ACTIVE });
      prisma.campaignParticipant.findUnique.mockResolvedValue(null);
      prisma.campaignParticipant.create.mockResolvedValue({});

      await service.joinCampaign('c-1', 'user-1');

      expect(prisma.campaignParticipant.create).toHaveBeenCalled();
    });

    it('accepts a PUBLISHED campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', status: CampaignStatus.PUBLISHED });
      prisma.campaignParticipant.findUnique.mockResolvedValue(null);
      prisma.campaignParticipant.create.mockResolvedValue({});

      await service.joinCampaign('c-1', 'user-1');

      expect(prisma.campaignParticipant.create).toHaveBeenCalled();
    });

    it('returns the existing participant row instead of creating a duplicate', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'c-1', status: CampaignStatus.ACTIVE });
      const existing = { campaignId: 'c-1', userId: 'user-1' };
      prisma.campaignParticipant.findUnique.mockResolvedValue(existing);

      const result = await service.joinCampaign('c-1', 'user-1');

      expect(result).toBe(existing);
      expect(prisma.campaignParticipant.create).not.toHaveBeenCalled();
    });
  });

  describe('leaveCampaign', () => {
    it('throws NotFoundException when the user is not a participant', async () => {
      prisma.campaignParticipant.findUnique.mockResolvedValue(null);

      await expect(service.leaveCampaign('c-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.campaignParticipant.delete).not.toHaveBeenCalled();
    });

    it('deletes the participant row when it exists', async () => {
      prisma.campaignParticipant.findUnique.mockResolvedValue({ campaignId: 'c-1', userId: 'user-1' });
      prisma.campaignParticipant.delete.mockResolvedValue({});

      const result = await service.leaveCampaign('c-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.campaignParticipant.delete).toHaveBeenCalledWith({
        where: { campaignId_userId: { campaignId: 'c-1', userId: 'user-1' } },
      });
    });
  });

  describe('getUserCampaigns', () => {
    it('flattens joinedAt/status from the participant row onto the campaign', async () => {
      prisma.campaignParticipant.findMany.mockResolvedValue([
        { campaign: { id: 'c-1', title: 'Drive' }, joinedAt: new Date('2026-01-01'), status: 'JOINED' },
      ]);
      prisma.campaignParticipant.count.mockResolvedValue(1);

      const result = await service.getUserCampaigns('user-1');

      expect(result.items[0]).toEqual(
        expect.objectContaining({ id: 'c-1', title: 'Drive', status: 'JOINED', joinedAt: new Date('2026-01-01') }),
      );
    });
  });
});
