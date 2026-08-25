import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { HealthTrendsService } from '../health-trends/health-trends.service';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { AIContextBuilderService } from './ai-context-builder-enhanced.service';

describe('AIContextBuilderService.buildEnhancedContext (donation context)', () => {
  let service: AIContextBuilderService;
  let prisma: any;
  let donationEligibility: { getNextEligibleDonationDate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      donation: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      laboratoryResult: { findMany: jest.fn().mockResolvedValue([]) },
    };
    donationEligibility = { getNextEligibleDonationDate: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIContextBuilderService,
        { provide: PrismaService, useValue: prisma },
        { provide: HealthTrendsService, useValue: {} },
        { provide: DonationEligibilityService, useValue: donationEligibility },
      ],
    }).compile();

    service = module.get<AIContextBuilderService>(AIContextBuilderService);
  });

  it('leaves nextEligibleDate undefined when the donor has never donated', async () => {
    const context = await service.buildEnhancedContext('user-1');

    expect(context.donations.nextEligibleDate).toBeUndefined();
  });

  it('sources nextEligibleDate from the shared DonationEligibilityService, not a local calculation', async () => {
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(
      new Date('2026-06-01T00:00:00.000Z'),
    );

    const context = await service.buildEnhancedContext('user-1');

    expect(donationEligibility.getNextEligibleDonationDate).toHaveBeenCalledWith('user-1');
    expect(context.donations.nextEligibleDate).toBe('2026-06-01T00:00:00.000Z');
  });
});
