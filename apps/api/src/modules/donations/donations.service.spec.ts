import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DonationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { DonationsService } from './donations.service';

function makeDonation(overrides: Record<string, any> = {}) {
  return {
    id: 'donation-1',
    donationReference: 'DONATION-2026-000001',
    donorId: 'donor-1',
    organizationId: 'org-1',
    status: DonationStatus.IN_PROGRESS,
    appointmentId: null,
    ...overrides,
  };
}

describe('DonationsService.completeDonation', () => {
  let service: DonationsService;
  let prisma: any;
  let tx: any;
  let donationEligibility: { computeDefaultNextEligibleDate: jest.Mock };

  beforeEach(async () => {
    tx = {
      donation: { update: jest.fn().mockResolvedValue(makeDonation({ status: DonationStatus.COMPLETED })) },
      appointment: { update: jest.fn().mockResolvedValue({}) },
      donationEvent: { create: jest.fn().mockResolvedValue({}) },
      bloodUnit: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      donation: { findUnique: jest.fn().mockResolvedValue(makeDonation()) },
      emergencyResponse: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    donationEligibility = {
      computeDefaultNextEligibleDate: jest.fn().mockReturnValue(new Date('2026-02-26T00:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DonationEligibilityService, useValue: donationEligibility },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
  });

  it('computes a default nextDonationDate via the shared service when staff omits it', async () => {
    await service.completeDonation('donation-1', 'org-1', 'staff-1', {
      collectionCompletedAt: new Date().toISOString(),
      volumeMl: 450,
    } as any);

    expect(donationEligibility.computeDefaultNextEligibleDate).toHaveBeenCalled();
    expect(tx.donation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextDonationDate: new Date('2026-02-26T00:00:00.000Z') }),
      }),
    );
  });

  it("uses staff's explicit nextDonationDate instead of the computed default when provided", async () => {
    const staffDate = '2026-08-01T00:00:00.000Z';

    await service.completeDonation('donation-1', 'org-1', 'staff-1', {
      collectionCompletedAt: new Date().toISOString(),
      volumeMl: 450,
      nextDonationDate: staffDate,
    } as any);

    expect(donationEligibility.computeDefaultNextEligibleDate).not.toHaveBeenCalled();
    expect(tx.donation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextDonationDate: new Date(staffDate) }),
      }),
    );
  });
});
