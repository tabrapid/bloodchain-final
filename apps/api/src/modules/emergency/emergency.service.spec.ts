import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DonorStatus,
  EmergencyResponseStatus,
  EmergencyStatus,
  OrganizationStatus,
  OrganizationType,
  Prisma,
  RoleCode,
} from '@prisma/client';
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
      componentType: 'WHOLE_BLOOD',
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

  it("derives the donation's componentType and donationType from the emergency request when not overridden", async () => {
    await service.completeEmergency('org-1', 'staff-1', 'resp-1', {});

    expect(tx.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ donationType: 'WHOLE_BLOOD' }) }),
    );
    expect(tx.bloodUnit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ componentType: 'WHOLE_BLOOD' }) }),
    );
  });

  it('lets staff override the componentType at completion, mapping RED_CELLS to DonationType.OTHER', async () => {
    prisma.emergencyResponse.findUnique.mockResolvedValue(
      makeResponse({ emergencyRequest: { hospitalId: 'org-1', bloodType: 'O', rhFactor: 'NEGATIVE', componentType: 'WHOLE_BLOOD', emergencyReference: 'SOS-2026-000001' } }),
    );

    await service.completeEmergency('org-1', 'staff-1', 'resp-1', { componentType: 'RED_CELLS' as any });

    expect(tx.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ donationType: 'OTHER' }) }),
    );
    expect(tx.bloodUnit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ componentType: 'RED_CELLS' }) }),
    );
  });

  it('retries the whole transaction on a donationReference/unitReference collision and succeeds', async () => {
    const collision = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['unitReference'] },
    });
    prisma.$transaction
      .mockImplementationOnce(async () => {
        throw collision;
      })
      .mockImplementationOnce(async (cb: any) => cb(tx));

    await service.completeEmergency('org-1', 'staff-1', 'resp-1', {});

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DONATION_COMPLETED_EVENT,
      expect.objectContaining({ donationId: 'donation-1' }),
    );
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

  it('defaults componentType to WHOLE_BLOOD when not provided', async () => {
    const prisma: any = {
      emergencyRequest: { create: jest.fn().mockResolvedValue({ id: 'req-1', emergencyReference: 'SOS-2026-000001' }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();
    const svc = module.get<EmergencyService>(EmergencyService);
    jest.spyOn(svc, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'staff-1' } } as any);

    await svc.createEmergency('org-1', 'staff-1', { bloodType: 'O', rhFactor: 'NEGATIVE', unitsRequired: 2 });

    expect(prisma.emergencyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ componentType: 'WHOLE_BLOOD' }) }),
    );
  });

  it('persists an explicit componentType when provided', async () => {
    const prisma: any = {
      emergencyRequest: { create: jest.fn().mockResolvedValue({ id: 'req-1', emergencyReference: 'SOS-2026-000001' }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();
    const svc = module.get<EmergencyService>(EmergencyService);
    jest.spyOn(svc, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'staff-1' } } as any);

    await svc.createEmergency('org-1', 'staff-1', {
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
      componentType: 'PLATELETS' as any,
      unitsRequired: 2,
    });

    expect(prisma.emergencyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ componentType: 'PLATELETS' }) }),
    );
  });

  it('retries the whole transaction on an emergencyReference collision and succeeds with a fresh reference', async () => {
    const tx: any = {
      emergencyRequest: { create: jest.fn().mockResolvedValue({ id: 'req-1', emergencyReference: 'SOS-2026-000002' }) },
    };
    const collision = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['emergencyReference'] },
    });
    const prisma: any = {
      $transaction: jest
        .fn()
        .mockImplementationOnce(async () => {
          throw collision;
        })
        .mockImplementationOnce(async (cb: any) => cb(tx)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();
    const svc = module.get<EmergencyService>(EmergencyService);
    jest.spyOn(svc, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'staff-1' } } as any);

    const result = await svc.createEmergency('org-1', 'staff-1', {
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
      unitsRequired: 2,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('req-1');
  });
});

describe('EmergencyService.checkHospitalAccess', () => {
  let service: EmergencyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      organization: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('allows hospital staff when the hospital is ACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      memberships: [{ organizationId: 'org-1', status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_ADMIN } }],
    });
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      type: OrganizationType.HOSPITAL,
      status: OrganizationStatus.ACTIVE,
    });

    await expect(service.checkHospitalAccess('staff-1', 'org-1')).resolves.toBeDefined();
  });

  it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
    'rejects hospital staff from triggering an SOS when the hospital is %s',
    async (status) => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'staff-1',
        memberships: [{ organizationId: 'org-1', status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_ADMIN } }],
      });
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', type: OrganizationType.HOSPITAL, status });

      await expect(service.checkHospitalAccess('staff-1', 'org-1')).rejects.toThrow(ForbiddenException);
    },
  );
});

function makeDonor(overrides: Record<string, any> = {}) {
  return {
    id: 'donor-1',
    donorProfile: {
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
      consentLocation: false,
      latitude: null,
      longitude: null,
    },
    emergencyMatches: [],
    emergencyResponses: [],
    ...overrides,
  };
}

describe('EmergencyService.activateEmergency', () => {
  let service: EmergencyService;
  let prisma: any;
  let tx: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    tx = {
      emergencyRequest: { update: jest.fn().mockResolvedValue({ id: 'req-1' }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      emergencyMatch: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      emergencyRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          hospitalId: 'org-1',
          status: EmergencyStatus.DRAFT,
          bloodType: 'O',
          rhFactor: 'NEGATIVE',
          urgencyLevel: 'CRITICAL',
          requiredBefore: null,
          latitude: '40.712800',
          longitude: '-74.006000',
        }),
      },
      emergencyMatch: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: EmergencyGateway, useValue: {} },
        { provide: DonationEligibilityService, useValue: {} },
        { provide: PlatformSettingsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
    jest.spyOn(service, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'staff-1' } } as any);
  });

  it('computes a real distanceKm and matchScore for a consenting donor with a location', async () => {
    // ~1.9km from the emergency's coordinates.
    tx.user.findMany.mockResolvedValue([
      makeDonor({ donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE', consentLocation: true, latitude: '40.73', longitude: '-74.0' } }),
    ]);

    await service.activateEmergency('org-1', 'staff-1', 'req-1');

    expect(tx.emergencyMatch.create).toHaveBeenCalledTimes(1);
    const { data } = tx.emergencyMatch.create.mock.calls[0][0];
    expect(data.distanceKm).toBeGreaterThan(0);
    expect(data.distanceKm).toBeLessThan(5);
    expect(data.matchScore).toBe(Math.max(0, Math.round(100 - data.distanceKm)));
  });

  it('leaves distanceKm/matchScore null for a donor who has not consented to location sharing', async () => {
    tx.user.findMany.mockResolvedValue([
      makeDonor({ donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE', consentLocation: false, latitude: '40.73', longitude: '-74.0' } }),
    ]);

    await service.activateEmergency('org-1', 'staff-1', 'req-1');

    const { data } = tx.emergencyMatch.create.mock.calls[0][0];
    expect(data.distanceKm).toBeNull();
    expect(data.matchScore).toBeNull();
  });

  it('ranks consenting donors nearest-first and sorts unknown-distance donors last', async () => {
    tx.user.findMany.mockResolvedValue([
      makeDonor({ id: 'far-donor', donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE', consentLocation: true, latitude: '41.5', longitude: '-73.5' } }),
      makeDonor({ id: 'no-location-donor' }),
      makeDonor({ id: 'near-donor', donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE', consentLocation: true, latitude: '40.72', longitude: '-74.01' } }),
    ]);

    await service.activateEmergency('org-1', 'staff-1', 'req-1');

    const matchedOrder = tx.emergencyMatch.create.mock.calls.map((call: any) => call[0].data.donorId);
    expect(matchedOrder).toEqual(['near-donor', 'far-donor', 'no-location-donor']);
  });

  it('leaves distanceKm null for every donor when the emergency itself has no location', async () => {
    prisma.emergencyRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      hospitalId: 'org-1',
      status: EmergencyStatus.DRAFT,
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
      urgencyLevel: 'CRITICAL',
      requiredBefore: null,
      latitude: null,
      longitude: null,
    });
    tx.user.findMany.mockResolvedValue([
      makeDonor({ donorProfile: { bloodType: 'O', rhFactor: 'NEGATIVE', consentLocation: true, latitude: '40.73', longitude: '-74.0' } }),
    ]);

    await service.activateEmergency('org-1', 'staff-1', 'req-1');

    const { data } = tx.emergencyMatch.create.mock.calls[0][0];
    expect(data.distanceKm).toBeNull();
  });
});
