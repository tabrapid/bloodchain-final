import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BloodType, DonationStatus, Prisma, RhFactor, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { DonationsService } from './donations.service';

/** A donor profile that staff have verified - an authoritative blood group. */
function verifiedProfile(overrides: Record<string, any> = {}) {
  return {
    bloodType: BloodType.A,
    rhFactor: RhFactor.POSITIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    ...overrides,
  };
}

function makeDonation(overrides: Record<string, any> = {}) {
  return {
    id: 'donation-1',
    donationReference: 'DONATION-2026-000001',
    donorId: 'donor-1',
    organizationId: 'org-1',
    status: DonationStatus.IN_PROGRESS,
    appointmentId: null,
    emergencyResponseId: null,
    donor: { id: 'donor-1', donorProfile: verifiedProfile() },
    ...overrides,
  };
}

function uniqueConstraintError(field: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [field] },
  });
}

describe('DonationsService.completeDonation', () => {
  let service: DonationsService;
  let prisma: any;
  let tx: any;
  let events: { emit: jest.Mock };
  let donationEligibility: { computeDefaultNextEligibleDate: jest.Mock };

  beforeEach(async () => {
    events = { emit: jest.fn() };
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
        { provide: EventEmitter2, useValue: events },
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

  it('retries the whole transaction on a unitReference collision and succeeds with a fresh reference', async () => {
    prisma.$transaction
      .mockImplementationOnce(async () => {
        throw uniqueConstraintError('unitReference');
      })
      .mockImplementationOnce(async (cb: any) => cb(tx));

    const result = await service.completeDonation('donation-1', 'org-1', 'staff-1', {
      collectionCompletedAt: new Date().toISOString(),
      volumeMl: 450,
      bloodType: 'O',
      rhFactor: 'POSITIVE',
    } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.data.status).toBe(DonationStatus.COMPLETED);
  });

  // Sprint 3, item 6. A completed donation is a bag of blood. Before this, a
  // completion with no blood group on the request still succeeded: the donor
  // was credited, and no BloodUnit was created. Nothing anywhere said so.
  describe('inventory integrity', () => {
    const base = { collectionCompletedAt: new Date().toISOString(), volumeMl: 450 };

    it('records the unit in the same transaction as the completion', async () => {
      await service.completeDonation('donation-1', 'org-1', 'staff-1', {
        ...base,
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
      } as any);

      expect(tx.bloodUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            donationId: 'donation-1',
            bloodType: 'O',
            rhFactor: 'NEGATIVE',
            volumeMl: 450,
            status: 'COLLECTED',
          }),
        }),
      );
    });

    it('falls back to the donor\'s verified blood group when staff record no group', async () => {
      await service.completeDonation('donation-1', 'org-1', 'staff-1', { ...base } as any);

      expect(tx.bloodUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bloodType: BloodType.A, rhFactor: RhFactor.POSITIVE }),
        }),
      );
      expect(tx.donationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ bloodTypeSource: 'VERIFIED_PROFILE' }),
          }),
        }),
      );
    });

    it('prefers what staff collected over the profile, and says so', async () => {
      await service.completeDonation('donation-1', 'org-1', 'staff-1', {
        ...base,
        bloodType: 'B',
        rhFactor: 'NEGATIVE',
      } as any);

      expect(tx.bloodUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bloodType: 'B', rhFactor: 'NEGATIVE' }),
        }),
      );
      expect(tx.donationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ bloodTypeSource: 'STAFF_ENTERED' }),
          }),
        }),
      );
    });

    it.each([
      ['an unverified profile', verifiedProfile({ verificationStatus: VerificationStatus.UNVERIFIED })],
      ['a profile awaiting review', verifiedProfile({ verificationStatus: VerificationStatus.REQUIRES_REVIEW })],
      ['a verified profile with no group on it', verifiedProfile({ bloodType: null, rhFactor: null })],
      ['no profile at all', null],
    ])('refuses completion outright with %s and no group from staff', async (_label, donorProfile) => {
      prisma.donation.findUnique.mockResolvedValue(
        makeDonation({ donor: { id: 'donor-1', donorProfile } }),
      );

      await expect(
        service.completeDonation('donation-1', 'org-1', 'staff-1', { ...base } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Neither half happened: no completion, no unit, no XP event.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.donation.update).not.toHaveBeenCalled();
      expect(tx.bloodUnit.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('refuses half a blood group rather than pairing it with the profile', async () => {
      await expect(
        service.completeDonation('donation-1', 'org-1', 'staff-1', {
          ...base,
          bloodType: 'O',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates no unit when the completion update fails, because both are one transaction', async () => {
      tx.donation.update.mockRejectedValue(new Error('database went away'));
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await expect(
        service.completeDonation('donation-1', 'org-1', 'staff-1', {
          ...base,
          bloodType: 'O',
          rhFactor: 'POSITIVE',
        } as any),
      ).rejects.toThrow('database went away');

      expect(tx.bloodUnit.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  // Sprint 3, item 5. `isEmergency` used to be inferred from the donor's
  // history: any completed emergency response by this donor with a matching
  // blood group, with no time bound and no link to this donation. One SOS
  // response made every later routine donation emergency-scored for good.
  describe('emergency attribution', () => {
    const dto = {
      collectionCompletedAt: new Date().toISOString(),
      volumeMl: 450,
      bloodType: 'O',
      rhFactor: 'POSITIVE',
    };

    function emittedPayload() {
      const call = events.emit.mock.calls.find(([name]) => name === 'donation.completed');
      return call?.[1];
    }

    it('marks the donation the SOS response produced as an emergency donation', async () => {
      tx.donation.update.mockResolvedValue(
        makeDonation({ status: DonationStatus.COMPLETED, emergencyResponseId: 'response-1' }),
      );

      await service.completeDonation('donation-1', 'org-1', 'staff-1', dto as any);

      expect(emittedPayload()).toEqual(expect.objectContaining({ isEmergency: true }));
    });

    it('does not carry that over to the same donor\'s next routine donation', async () => {
      // The donor has an emergency response on record - the old heuristic's
      // only input. This donation simply is not linked to it.
      prisma.emergencyResponse.findFirst.mockResolvedValue({ id: 'response-1' });
      tx.donation.update.mockResolvedValue(
        makeDonation({ status: DonationStatus.COMPLETED, emergencyResponseId: null }),
      );

      await service.completeDonation('donation-1', 'org-1', 'staff-1', dto as any);

      expect(emittedPayload()).toEqual(expect.objectContaining({ isEmergency: false }));
    });
  });
});

describe('DonationsService.checkInDonation', () => {
  let service: DonationsService;
  let prisma: any;
  let tx: any;
  let eligibility: { assertEligibleToDonateAt: jest.Mock };

  const appointment = {
    id: 'appt-1',
    organizationId: 'org-1',
    appointmentType: 'BLOOD_DONATION',
    status: 'PENDING',
    donorId: 'donor-1',
    donor: {
      id: 'donor-1',
      firstName: 'Test',
      lastName: 'Donor',
      email: 'donor@donor.local',
      donorProfile: { bloodType: 'O', rhFactor: 'POSITIVE' },
    },
    organization: { id: 'org-1', name: 'Test Org', type: 'HOSPITAL', address: '123 Main St' },
  };

  beforeEach(async () => {
    tx = {
      donation: {
        create: jest.fn().mockResolvedValue({
          id: 'donation-1',
          donationReference: 'DONATION-2026-000002',
          status: DonationStatus.CHECKED_IN,
          donationType: 'WHOLE_BLOOD',
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          organization: appointment.organization,
        }),
      },
      donationEvent: { create: jest.fn().mockResolvedValue({}) },
      appointment: { update: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      appointment: { findUnique: jest.fn().mockResolvedValue(appointment) },
      donation: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    eligibility = { assertEligibleToDonateAt: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DonationEligibilityService, useValue: eligibility },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
  });

  // S0-2 regression tests.
  //
  // An appointment is a claim made at booking time; by the day of the donation
  // the donor may have given blood elsewhere, or answered an emergency. The
  // booking gate cannot see that, so check-in asks again -- against now, not
  // against the slot.
  it('re-checks eligibility at check-in, against the current moment', async () => {
    const before = Date.now();

    await service.checkInDonation('appt-1', 'org-1', 'staff-1', {} as any);

    expect(eligibility.assertEligibleToDonateAt).toHaveBeenCalledTimes(1);
    const [donorId, when] = eligibility.assertEligibleToDonateAt.mock.calls[0];
    expect(donorId).toBe(appointment.donorId);
    expect(when.getTime()).toBeGreaterThanOrEqual(before);
    expect(when.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('refuses check-in without creating a donation when the donor is inside their recovery window', async () => {
    eligibility.assertEligibleToDonateAt.mockRejectedValue(
      new ConflictException({ code: 'DONOR_IN_RECOVERY_WINDOW' }),
    );

    await expect(
      service.checkInDonation('appt-1', 'org-1', 'staff-1', {} as any),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.donation.create).not.toHaveBeenCalled();
  });

  it('retries the whole transaction on a donationReference collision and succeeds with a fresh reference', async () => {
    prisma.$transaction
      .mockImplementationOnce(async () => {
        throw uniqueConstraintError('donationReference');
      })
      .mockImplementationOnce(async (cb: any) => cb(tx));

    const result = await service.checkInDonation('appt-1', 'org-1', 'staff-1', {} as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.data.status).toBe(DonationStatus.CHECKED_IN);
  });

  it('does not retry and rethrows for an unrelated error', async () => {
    const error = new Error('connection lost');
    prisma.$transaction.mockRejectedValue(error);

    await expect(service.checkInDonation('appt-1', 'org-1', 'staff-1', {} as any)).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('DonationsService.getMyDonationStatistics', () => {
  let service: DonationsService;
  let prisma: any;
  let donationEligibility: { getNextEligibleDonationDate: jest.Mock };

  const completed = (overrides: Record<string, any> = {}) => ({
    status: DonationStatus.COMPLETED,
    volumeMl: 450,
    collectionCompletedAt: new Date('2026-07-03T10:00:00Z'),
    nextDonationDate: new Date('2026-08-28T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = { donation: { findMany: jest.fn() } };
    donationEligibility = { getNextEligibleDonationDate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DonationEligibilityService, useValue: donationEligibility },
      ],
    }).compile();

    service = module.get(DonationsService);
  });

  /**
   * The statistics endpoint used to re-derive the next eligible date itself, by
   * taking the *earliest* nextDonationDate across every completed donation. The
   * first donation's date therefore won forever: a donor who gave blood this
   * morning still saw an eligibility date from months ago on their home screen.
   */
  it('reports the eligibility date from the shared service, not the earliest one on record', async () => {
    prisma.donation.findMany.mockResolvedValue([
      completed({ nextDonationDate: new Date('2026-03-01T00:00:00Z') }),
      completed({
        collectionCompletedAt: new Date('2026-09-11T10:00:00Z'),
        nextDonationDate: new Date('2026-11-06T10:00:00Z'),
      }),
    ]);
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(new Date('2026-11-06T10:00:00Z'));

    const { data } = await service.getMyDonationStatistics('donor-1');

    expect(donationEligibility.getNextEligibleDonationDate).toHaveBeenCalledWith('donor-1');
    expect(data.nextDonationDate).toEqual(new Date('2026-11-06T10:00:00Z'));
  });

  /**
   * An emergency donation records no explicit nextDonationDate, and the old
   * derivation skipped every donation that had none -- so answering an
   * emergency left the donor's eligibility frozen at whatever a booked donation
   * had last set.
   */
  it('still reports an eligibility date when the latest donation carries none', async () => {
    prisma.donation.findMany.mockResolvedValue([
      completed({ collectionCompletedAt: new Date('2026-09-11T10:00:00Z'), nextDonationDate: null }),
    ]);
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(new Date('2026-11-06T10:00:00Z'));

    const { data } = await service.getMyDonationStatistics('donor-1');

    expect(data.nextDonationDate).toEqual(new Date('2026-11-06T10:00:00Z'));
    expect(data.totalVolumeMl).toBe(450);
    expect(data.completedCount).toBe(1);
  });
});
