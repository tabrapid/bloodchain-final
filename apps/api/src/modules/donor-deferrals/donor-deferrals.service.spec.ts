import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DeferralKind, DeferralSource } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorDeferralsService } from './donor-deferrals.service';

/**
 * The deferral predicate, and the rules around changing one.
 *
 * `isDeferredAt` is asked by booking, by check-in and by emergency matching, so
 * getting its window arithmetic wrong is three bugs rather than one: a deferral
 * that has not started yet counted as active refuses a donor who is fine, and
 * one that has ended counted as active refuses them forever.
 */
describe('DonorDeferralsService', () => {
  let service: DonorDeferralsService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      donorDeferral: {
        create: jest.fn().mockResolvedValue({ id: 'def-1', kind: 'INDEFINITE', endsAt: null, liftedAt: null }),
        update: jest.fn().mockResolvedValue({ id: 'def-1', liftedAt: new Date(), endsAt: null }),
        count: jest.fn().mockResolvedValue(0),
      },
      donorProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      donorDeferral: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      donorProfile: { updateMany: jest.fn() },
      organizationMembership: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'donor-1' }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorDeferralsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get(DonorDeferralsService);
  });

  /** Sprint 7 safety test 9, on the query shape the predicate builds. */
  describe('isDeferredAt', () => {
    const when = new Date('2026-06-15T12:00:00.000Z');

    it('asks only about deferrals that have not been lifted', async () => {
      await service.isDeferredAt('donor-1', when);

      expect(prisma.donorDeferral.count).toHaveBeenCalledWith({
        where: {
          donorId: 'donor-1',
          // A lifted deferral stays on the record and stops applying. Both
          // halves matter: the row is history, the lift is the end of its
          // effect.
          liftedAt: null,
          startsAt: { lte: when },
          OR: [{ endsAt: null }, { endsAt: { gt: when } }],
        },
      });
    });

    it('is false when nothing matches', async () => {
      prisma.donorDeferral.count.mockResolvedValue(0);
      expect(await service.isDeferredAt('donor-1', when)).toBe(false);
    });

    it('is true when something does', async () => {
      prisma.donorDeferral.count.mockResolvedValue(1);
      expect(await service.isDeferredAt('donor-1', when)).toBe(true);
    });
  });

  describe('findDeferredDonorIds', () => {
    it('answers for a whole candidate set in one query', async () => {
      prisma.donorDeferral.findMany.mockResolvedValue([{ donorId: 'b' }]);

      const deferred = await service.findDeferredDonorIds(['a', 'b', 'c'], new Date());

      expect(prisma.donorDeferral.findMany).toHaveBeenCalledTimes(1);
      expect(deferred.has('b')).toBe(true);
      expect(deferred.has('a')).toBe(false);
    });

    it('does not query at all for an empty candidate set', async () => {
      const deferred = await service.findDeferredDonorIds([], new Date());
      expect(deferred.size).toBe(0);
      expect(prisma.donorDeferral.findMany).not.toHaveBeenCalled();
    });
  });

  describe('assertNotDeferredAt', () => {
    it('refuses with a machine-readable code when a deferral is in force', async () => {
      prisma.donorDeferral.findFirst.mockResolvedValue({
        id: 'def-1',
        kind: DeferralKind.INDEFINITE,
        reasonCode: 'SOME_CODE',
        reasonText: 'clinical detail nobody outside staff should read from an API error',
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        source: DeferralSource.DONATION_ASSESSMENT,
      });

      await expect(service.assertNotDeferredAt('donor-1', new Date())).rejects.toThrow(ConflictException);
    });

    it('does not put the clinical reason in the refusal', async () => {
      const reasonText = 'clinical detail nobody outside staff should read from an API error';
      prisma.donorDeferral.findFirst.mockResolvedValue({
        id: 'def-1',
        kind: DeferralKind.INDEFINITE,
        reasonCode: 'SOME_CODE',
        reasonText,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        source: DeferralSource.DONATION_ASSESSMENT,
      });

      // A donor's own client calls the endpoints this guards. That they are
      // deferred is theirs to know; why is a conversation with staff.
      await expect(service.assertNotDeferredAt('donor-1', new Date())).rejects.toMatchObject({
        response: { code: 'DONOR_DEFERRED' },
      });
      const error = await service.assertNotDeferredAt('donor-1', new Date()).catch((e) => e);
      expect(JSON.stringify(error.getResponse())).not.toContain(reasonText);
      expect(JSON.stringify(error.getResponse())).not.toContain('SOME_CODE');
    });

    it('permits when nothing is in force', async () => {
      prisma.donorDeferral.findFirst.mockResolvedValue(null);
      await expect(service.assertNotDeferredAt('donor-1', new Date())).resolves.toBeUndefined();
    });
  });

  describe('createInTransaction', () => {
    const base = {
      donorId: 'donor-1',
      organizationId: 'org-1',
      source: DeferralSource.STAFF_DECISION,
      createdBy: 'staff-1',
    };

    it('refuses a temporary deferral with no end date', async () => {
      await expect(
        service.createInTransaction(tx, { ...base, kind: DeferralKind.TEMPORARY, endsAt: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses an indefinite deferral that carries one', async () => {
      await expect(
        service.createInTransaction(tx, {
          ...base,
          kind: DeferralKind.INDEFINITE,
          endsAt: new Date('2027-01-01T00:00:00.000Z'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('keeps the profile flag in step as a cache', async () => {
      await service.createInTransaction(tx, { ...base, kind: DeferralKind.INDEFINITE });

      expect(tx.donorProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'donor-1' },
        data: { donorStatus: 'DEFERRED' },
      });
    });
  });

  describe('liftDeferral', () => {
    beforeEach(() => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: 'org-1', role: { code: 'BLOOD_CENTER_STAFF' } },
      ]);
      prisma.donorDeferral.findUnique.mockResolvedValue({
        id: 'def-1',
        donorId: 'donor-1',
        liftedAt: null,
      });
    });

    it('updates the row rather than deleting it', async () => {
      await service.liftDeferral('org-1', 'def-1', 'staff-1', 'resolved');

      expect(tx.donorDeferral.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { liftedAt: expect.any(Date), liftedBy: 'staff-1', liftReason: 'resolved' },
      });
      expect((tx.donorDeferral as any).delete).toBeUndefined();
    });

    it('returns the donor to ACTIVE only when nothing else still defers them', async () => {
      tx.donorDeferral.count.mockResolvedValue(0);
      await service.liftDeferral('org-1', 'def-1', 'staff-1', 'resolved');
      expect(tx.donorProfile.updateMany).toHaveBeenCalled();
    });

    it('leaves the donor deferred when another deferral is still in force', async () => {
      tx.donorDeferral.count.mockResolvedValue(1);
      await service.liftDeferral('org-1', 'def-1', 'staff-1', 'resolved');
      expect(tx.donorProfile.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a second lift', async () => {
      prisma.donorDeferral.findUnique.mockResolvedValue({
        id: 'def-1',
        donorId: 'donor-1',
        liftedAt: new Date(),
      });

      await expect(service.liftDeferral('org-1', 'def-1', 'staff-1', 'again')).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses someone who is not staff of this organisation', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: 'other-org', role: { code: 'BLOOD_CENTER_STAFF' } },
      ]);

      await expect(service.liftDeferral('org-1', 'def-1', 'staff-1', 'nope')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("a donor's own view", () => {
    it('never says a donor may lift their own deferral', async () => {
      prisma.donorDeferral.findFirst.mockResolvedValue({
        id: 'def-1',
        kind: DeferralKind.INDEFINITE,
        reasonCode: 'X',
        reasonText: 'staff-only detail',
        startsAt: new Date(),
        endsAt: null,
        source: DeferralSource.DONATION_ASSESSMENT,
      });

      const result = await service.getOwnDeferral('donor-1');

      expect(result.data.deferred).toBe(true);
      expect(result.data.canLift).toBe(false);
      // The reason is staff's to explain in person, not the API's to hand back.
      expect(JSON.stringify(result.data)).not.toContain('staff-only detail');
    });
  });
});
