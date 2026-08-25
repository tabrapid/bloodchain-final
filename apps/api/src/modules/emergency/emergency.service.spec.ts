import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DonorStatus, EmergencyResponseStatus, EmergencyStatus, RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmergencyGateway } from '../../gateways/emergency.gateway';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
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
        { provide: DonationEligibilityService, useValue: { getNextEligibleDonationDate: jest.fn() } },
        { provide: PlatformSettingsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
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
  let donationEligibility: { getNextEligibleDonationDate: jest.Mock };

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
    };
    donationEligibility = { getNextEligibleDonationDate: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: donationEligibility },
        { provide: PlatformSettingsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('passes when the donor has never donated before', async () => {
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(null);

    await expect(service.checkDonorEligibility('donor-1')).resolves.toBeDefined();
    expect(donationEligibility.getNextEligibleDonationDate).toHaveBeenCalledWith('donor-1');
  });

  it('passes once the eligible date from the shared service has already elapsed', async () => {
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    await expect(service.checkDonorEligibility('donor-1')).resolves.toBeDefined();
  });

  it('rejects when the shared service reports a future eligible date', async () => {
    donationEligibility.getNextEligibleDonationDate.mockResolvedValue(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    await expect(service.checkDonorEligibility('donor-1')).rejects.toThrow(ForbiddenException);
  });
});

describe('EmergencyService.createEmergency', () => {
  let service: EmergencyService;
  let platformSettings: { isEnabled: jest.Mock };

  beforeEach(async () => {
    platformSettings = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('rejects before checking hospital access when SOS emergency is disabled platform-wide', async () => {
    platformSettings.isEnabled.mockResolvedValue(false);
    const accessSpy = jest.spyOn(service, 'checkHospitalAccess');

    await expect(
      service.createEmergency('org-1', 'staff-1', {
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
        unitsRequired: 2,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(platformSettings.isEnabled).toHaveBeenCalledWith('sosEmergencyEnabled');
    expect(accessSpy).not.toHaveBeenCalled();
  });

  it('proceeds past the feature-flag check when SOS emergency is enabled', async () => {
    const marker = new Error('reached checkHospitalAccess');
    jest.spyOn(service, 'checkHospitalAccess').mockRejectedValue(marker);

    await expect(
      service.createEmergency('org-1', 'staff-1', {
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
        unitsRequired: 2,
      }),
    ).rejects.toBe(marker);
  });
});
