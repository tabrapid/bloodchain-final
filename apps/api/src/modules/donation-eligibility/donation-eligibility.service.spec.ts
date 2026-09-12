import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { DonationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DonationEligibilityService } from './donation-eligibility.service';

/**
 * The recovery window used to be computed and displayed but enforced in only
 * one place -- accepting an emergency. Booking and check-in applied nothing, so
 * a donor who gave blood yesterday could book and complete another donation
 * today. These tests pin the rule itself; the call sites are covered by the
 * live integration run.
 */
describe('DonationEligibilityService', () => {
  let service: DonationEligibilityService;
  let prisma: any;

  const COOLDOWN_DAYS = 56;

  beforeEach(async () => {
    prisma = { donation: { findFirst: jest.fn(), findMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationEligibilityService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback: number) => fallback) },
        },
      ],
    }).compile();
    service = module.get(DonationEligibilityService);
  });

  describe('getNextEligibleDonationDate', () => {
    it('returns null when the donor has never completed a donation', async () => {
      prisma.donation.findFirst.mockResolvedValue(null);
      expect(await service.getNextEligibleDonationDate('donor-1')).toBeNull();
    });

    it('prefers the explicit staff-entered next date', async () => {
      const staffDate = new Date('2026-12-01T00:00:00Z');
      prisma.donation.findFirst.mockResolvedValue({
        completedAt: new Date('2026-09-01T00:00:00Z'),
        nextDonationDate: staffDate,
      });
      expect(await service.getNextEligibleDonationDate('donor-1')).toEqual(staffDate);
    });

    it('falls back to the configured cooldown from the completion date', async () => {
      prisma.donation.findFirst.mockResolvedValue({
        completedAt: new Date('2026-09-01T00:00:00Z'),
        nextDonationDate: null,
      });
      const expected = new Date('2026-09-01T00:00:00Z');
      expected.setDate(expected.getDate() + COOLDOWN_DAYS);
      expect(await service.getNextEligibleDonationDate('donor-1')).toEqual(expected);
    });

    /**
     * Postgres sorts NULLs first on DESC, so a COMPLETED row with no completion
     * date would be selected as "most recent" and then, having no date, read
     * back as "no donation on record" -- i.e. always eligible.
     */
    it('excludes completed donations that carry no completion date', async () => {
      await service.getNextEligibleDonationDate('donor-1');
      expect(prisma.donation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            donorId: 'donor-1',
            status: DonationStatus.COMPLETED,
            completedAt: { not: null },
          },
        }),
      );
    });
  });

  describe('isEligibleAt', () => {
    const nextEligible = new Date('2026-10-01T00:00:00Z');

    it('treats no recovery window as always eligible', () => {
      expect(service.isEligibleAt(null, new Date('2020-01-01T00:00:00Z'))).toBe(true);
      expect(service.isEligibleAt(undefined, new Date('2020-01-01T00:00:00Z'))).toBe(true);
    });

    it('is ineligible strictly before the next eligible date', () => {
      expect(service.isEligibleAt(nextEligible, new Date('2026-09-30T23:59:59Z'))).toBe(false);
    });

    it('is eligible exactly on and after the next eligible date', () => {
      expect(service.isEligibleAt(nextEligible, nextEligible)).toBe(true);
      expect(service.isEligibleAt(nextEligible, new Date('2026-10-02T00:00:00Z'))).toBe(true);
    });

    /**
     * The reason the moment is a parameter: a donor three days from the end of
     * their window may legitimately book a slot next week. Answering every
     * caller against `now` would refuse valid future bookings, which would be a
     * new restriction rather than enforcement of the existing rule.
     */
    it('allows a future moment past the window even while currently ineligible', () => {
      const now = new Date('2026-09-20T00:00:00Z');
      const slotNextMonth = new Date('2026-10-15T00:00:00Z');
      expect(service.isEligibleAt(nextEligible, now)).toBe(false);
      expect(service.isEligibleAt(nextEligible, slotNextMonth)).toBe(true);
    });
  });

  describe('assertEligibleToDonateAt', () => {
    it('passes silently when the donor has no recovery window', async () => {
      prisma.donation.findFirst.mockResolvedValue(null);
      await expect(service.assertEligibleToDonateAt('donor-1', new Date())).resolves.toBeUndefined();
    });

    it('throws a ConflictException carrying a machine-readable domain code', async () => {
      const nextDonationDate = new Date('2026-11-06T00:00:00Z');
      prisma.donation.findFirst.mockResolvedValue({
        completedAt: new Date('2026-09-11T00:00:00Z'),
        nextDonationDate,
      });

      let thrown: ConflictException | undefined;
      try {
        await service.assertEligibleToDonateAt('donor-1', new Date('2026-09-12T00:00:00Z'));
      } catch (err) {
        thrown = err as ConflictException;
      }

      expect(thrown).toBeInstanceOf(ConflictException);
      const body = thrown!.getResponse() as {
        code: string;
        message: string;
        details: { nextEligibleDonationDate: string };
      };
      expect(body.code).toBe('DONOR_IN_RECOVERY_WINDOW');
      expect(body.message).toContain('2026-11-06');
      expect(body.details.nextEligibleDonationDate).toBe(nextDonationDate.toISOString());
    });
  });

  describe('getNextEligibleDonationDates', () => {
    it('returns an empty map without querying for an empty donor list', async () => {
      const dates = await service.getNextEligibleDonationDates([]);
      expect(dates.size).toBe(0);
      expect(prisma.donation.findMany).not.toHaveBeenCalled();
    });

    /**
     * One query for the whole candidate set: emergency matching needs this for
     * every donor it is about to alert, and a query per donor would run inside
     * the matching transaction.
     */
    it('resolves the latest completed donation per donor in one query', async () => {
      prisma.donation.findMany.mockResolvedValue([
        { donorId: 'a', completedAt: new Date('2026-09-01T00:00:00Z'), nextDonationDate: new Date('2026-11-01T00:00:00Z') },
        { donorId: 'b', completedAt: new Date('2026-08-01T00:00:00Z'), nextDonationDate: null },
      ]);

      const dates = await service.getNextEligibleDonationDates(['a', 'b', 'c']);

      expect(prisma.donation.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.donation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ distinct: ['donorId'] }),
      );
      expect(dates.get('a')).toEqual(new Date('2026-11-01T00:00:00Z'));
      const computed = new Date('2026-08-01T00:00:00Z');
      computed.setDate(computed.getDate() + COOLDOWN_DAYS);
      expect(dates.get('b')).toEqual(computed);
      // A donor with no completed donation is absent, which callers read as
      // "no recovery window" -- the same meaning as the single-donor null.
      expect(dates.has('c')).toBe(false);
    });
  });
});
