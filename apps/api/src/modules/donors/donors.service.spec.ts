import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BloodType, RhFactor, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DonorsService } from './donors.service';

function makeProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'profile-1',
    userId: 'donor-1',
    bloodType: BloodType.O,
    rhFactor: RhFactor.POSITIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    city: 'Springfield',
    ...overrides,
  };
}

describe('DonorsService.updateProfile', () => {
  let service: DonorsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      donorProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<DonorsService>(DonorsService);
  });

  it('does not reset verificationStatus when updating unrelated fields', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile());
    prisma.donorProfile.update.mockResolvedValue(makeProfile({ city: 'Shelbyville' }));

    await service.updateProfile('donor-1', { city: 'Shelbyville' });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: { city: 'Shelbyville' },
    });
  });

  it('does not reset verificationStatus when dateOfBirth or location change', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile());
    prisma.donorProfile.update.mockResolvedValue(makeProfile());

    await service.updateProfile('donor-1', { latitude: 40.7, longitude: -74.0 });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: { latitude: 40.7, longitude: -74.0 },
    });
  });

  it('does not reset verificationStatus when bloodType/rhFactor are resubmitted unchanged', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile());
    prisma.donorProfile.update.mockResolvedValue(makeProfile());

    await service.updateProfile('donor-1', { bloodType: BloodType.O, rhFactor: RhFactor.POSITIVE });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: { bloodType: BloodType.O, rhFactor: RhFactor.POSITIVE },
    });
  });

  it('resets verificationStatus to REQUIRES_REVIEW when bloodType actually changes', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile({ bloodType: BloodType.O }));
    prisma.donorProfile.update.mockResolvedValue(
      makeProfile({ bloodType: BloodType.A, verificationStatus: VerificationStatus.REQUIRES_REVIEW }),
    );

    await service.updateProfile('donor-1', { bloodType: BloodType.A });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: { bloodType: BloodType.A, verificationStatus: VerificationStatus.REQUIRES_REVIEW },
    });
  });

  it('resets verificationStatus to REQUIRES_REVIEW when only rhFactor changes', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile({ rhFactor: RhFactor.POSITIVE }));
    prisma.donorProfile.update.mockResolvedValue(
      makeProfile({ rhFactor: RhFactor.NEGATIVE, verificationStatus: VerificationStatus.REQUIRES_REVIEW }),
    );

    await service.updateProfile('donor-1', { rhFactor: RhFactor.NEGATIVE });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: { rhFactor: RhFactor.NEGATIVE, verificationStatus: VerificationStatus.REQUIRES_REVIEW },
    });
  });

  it('resets verificationStatus alongside an unrelated field changing in the same request', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(makeProfile({ bloodType: BloodType.O }));
    prisma.donorProfile.update.mockResolvedValue(makeProfile({ bloodType: BloodType.AB, city: 'Shelbyville' }));

    await service.updateProfile('donor-1', { bloodType: BloodType.AB, city: 'Shelbyville' });

    expect(prisma.donorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'donor-1' },
      data: {
        bloodType: BloodType.AB,
        city: 'Shelbyville',
        verificationStatus: VerificationStatus.REQUIRES_REVIEW,
      },
    });
  });

  it('throws NotFoundException when the profile does not exist', async () => {
    prisma.donorProfile.findUnique.mockResolvedValue(null);

    await expect(service.updateProfile('donor-1', { city: 'Shelbyville' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.donorProfile.update).not.toHaveBeenCalled();
  });
});
