import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DonationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DonationEligibilityService } from './donation-eligibility.service';

describe('DonationEligibilityService', () => {
  let service: DonationEligibilityService;
  let prisma: { donation: { findFirst: jest.Mock } };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { donation: { findFirst: jest.fn().mockResolvedValue(null) } };
    config = { get: jest.fn().mockReturnValue(56) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationEligibilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<DonationEligibilityService>(DonationEligibilityService);
  });

  describe('computeDefaultNextEligibleDate', () => {
    it('adds the configured cooldown in days to the given date', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');

      const result = service.computeDefaultNextEligibleDate(from);

      expect(result.toISOString()).toBe('2026-02-26T00:00:00.000Z'); // +56 days
    });

    it('reads the cooldown from DONATION_COOLDOWN_DAYS with a 56-day default', () => {
      service.computeDefaultNextEligibleDate(new Date());

      expect(config.get).toHaveBeenCalledWith('DONATION_COOLDOWN_DAYS', 56);
    });

    it('respects a configured cooldown other than the default', () => {
      config.get.mockReturnValue(28);
      const from = new Date('2026-01-01T00:00:00.000Z');

      const result = service.computeDefaultNextEligibleDate(from);

      expect(result.toISOString()).toBe('2026-01-29T00:00:00.000Z'); // +28 days
    });
  });

  describe('getNextEligibleDonationDate', () => {
    it('returns null when the donor has no completed donation', async () => {
      prisma.donation.findFirst.mockResolvedValue(null);

      const result = await service.getNextEligibleDonationDate('donor-1');

      expect(result).toBeNull();
      expect(prisma.donation.findFirst).toHaveBeenCalledWith({
        where: { donorId: 'donor-1', status: DonationStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, nextDonationDate: true },
      });
    });

    it('falls back to the computed default when no explicit nextDonationDate is stored', async () => {
      const completedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.donation.findFirst.mockResolvedValue({ completedAt, nextDonationDate: null });

      const result = await service.getNextEligibleDonationDate('donor-1');

      expect(result?.toISOString()).toBe('2026-02-26T00:00:00.000Z');
    });

    it('prefers an explicit staff-entered nextDonationDate over the computed default', async () => {
      const completedAt = new Date('2026-01-01T00:00:00.000Z');
      const nextDonationDate = new Date('2026-06-01T00:00:00.000Z');
      prisma.donation.findFirst.mockResolvedValue({ completedAt, nextDonationDate });

      const result = await service.getNextEligibleDonationDate('donor-1');

      expect(result).toBe(nextDonationDate);
    });
  });

  describe('isEligibleToDonate', () => {
    it('is true when there is no completed donation on record', async () => {
      prisma.donation.findFirst.mockResolvedValue(null);

      await expect(service.isEligibleToDonate('donor-1')).resolves.toBe(true);
    });

    it('is true once the eligible date has passed', async () => {
      prisma.donation.findFirst.mockResolvedValue({
        completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        nextDonationDate: null,
      });

      await expect(service.isEligibleToDonate('donor-1')).resolves.toBe(true);
    });

    it('is false while still inside the cooldown window', async () => {
      prisma.donation.findFirst.mockResolvedValue({
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        nextDonationDate: null,
      });

      await expect(service.isEligibleToDonate('donor-1')).resolves.toBe(false);
    });
  });
});
