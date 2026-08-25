import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DonationStatus, DonorStatus, EmergencyResponseStatus, EmergencyStatus, RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmergencyGateway } from '../../gateways/emergency.gateway';
import { EmergencyService } from './emergency.service';
import {
  DONATION_COMPLETED_EVENT,
  EMERGENCY_RESPONSE_COMPLETED_EVENT,
} from '../gamification/events/gamification-event.handler';

function makeResponse(overrides: Record<string, any> = {}) {
  return {
    id: 'resp-1',
    donorId: 'donor-1',
    emergencyRequestId: 'req-1',
    status: EmergencyResponseStatus.DONATION_STARTED,
    donationStartedAt: new Date(),
    emergencyRequest: {
      hospitalId: 'org-1',
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
      emergencyReference: 'SOS-2026-000001',
    },
    donor: { donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE' } },
    ...overrides,
  };
}

describe('EmergencyService.completeEmergency', () => {
  let service: EmergencyService;
  let prisma: any;
  let tx: any;
  let eventEmitter: { emit: jest.Mock };
  let gateway: { emitResponseStatusChanged: jest.Mock };

  beforeEach(async () => {
    tx = {
      donation: { create: jest.fn().mockResolvedValue({ id: 'donation-1' }) },
      donationEvent: { create: jest.fn().mockResolvedValue({}) },
      bloodUnit: { create: jest.fn().mockResolvedValue({}) },
      emergencyResponse: {
        update: jest.fn().mockResolvedValue({ id: 'resp-1', status: EmergencyResponseStatus.COMPLETED }),
      },
      emergencyRequest: {
        update: jest.fn().mockResolvedValue({ unitsCollected: 1, unitsRequired: 2 }),
      },
    };

    prisma = {
      emergencyResponse: { findUnique: jest.fn().mockResolvedValue(makeResponse()) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    eventEmitter = { emit: jest.fn() };
    gateway = { emitResponseStatusChanged: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: EmergencyGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);

    jest.spyOn(service, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'staff-1' } } as any);
  });

  it('emits both DONATION_COMPLETED_EVENT and EMERGENCY_RESPONSE_COMPLETED_EVENT', async () => {
    await service.completeEmergency('org-1', 'staff-1', 'resp-1', {});

    expect(eventEmitter.emit).toHaveBeenCalledWith(DONATION_COMPLETED_EVENT, {
      donationId: 'donation-1',
      donorId: 'donor-1',
      organizationId: 'org-1',
      isEmergency: true,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(EMERGENCY_RESPONSE_COMPLETED_EVENT, {
      responseId: 'resp-1',
      donorId: 'donor-1',
    });
  });

  it('rejects when the response is not in DONATION_STARTED state', async () => {
    prisma.emergencyResponse.findUnique.mockResolvedValue(
      makeResponse({ status: EmergencyResponseStatus.ARRIVED }),
    );

    await expect(service.completeEmergency('org-1', 'staff-1', 'resp-1', {})).rejects.toThrow();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('closes the emergency request once units collected reaches units required', async () => {
    tx.emergencyRequest.update.mockResolvedValue({ unitsCollected: 2, unitsRequired: 2 });

    await service.completeEmergency('org-1', 'staff-1', 'resp-1', {});

    expect(tx.emergencyRequest.update).toHaveBeenLastCalledWith({
      where: { id: 'req-1' },
      data: { status: EmergencyStatus.COMPLETED, closedAt: expect.any(Date) },
    });
  });
});

describe('EmergencyService.checkDonorEligibility', () => {
  let service: EmergencyService;
  let prisma: any;

  function makeUser(overrides: Record<string, any> = {}) {
    return {
      id: 'donor-1',
      emailVerified: true,
      memberships: [{ role: { code: RoleCode.DONOR } }],
      donorProfile: {
        donorStatus: DonorStatus.ACTIVE,
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
      },
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(makeUser()) },
      donation: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('passes when the donor has never donated before', async () => {
    prisma.donation.findFirst.mockResolvedValue(null);

    await expect(service.checkDonorEligibility('donor-1')).resolves.toBeDefined();
  });

  it('passes once the 56-day cooldown from the last completed donation has elapsed', async () => {
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    prisma.donation.findFirst.mockResolvedValue({ completedAt, nextDonationDate: null });

    await expect(service.checkDonorEligibility('donor-1')).resolves.toBeDefined();
    expect(prisma.donation.findFirst).toHaveBeenCalledWith({
      where: { donorId: 'donor-1', status: DonationStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, nextDonationDate: true },
    });
  });

  it('rejects a donor still inside the default 56-day cooldown window', async () => {
    const completedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    prisma.donation.findFirst.mockResolvedValue({ completedAt, nextDonationDate: null });

    await expect(service.checkDonorEligibility('donor-1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects using the staff-set nextDonationDate when it extends past the default cooldown', async () => {
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // past default 56 days
    const nextDonationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // staff extended it
    prisma.donation.findFirst.mockResolvedValue({ completedAt, nextDonationDate });

    await expect(service.checkDonorEligibility('donor-1')).rejects.toThrow(ForbiddenException);
  });
});
