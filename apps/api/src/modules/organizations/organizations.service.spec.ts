import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: { organization: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('findMany', () => {
    it('always excludes the internal SYSTEM placeholder org (donor accounts)', async () => {
      await service.findMany(1, 20);

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { type: { not: 'SYSTEM' }, status: 'ACTIVE' },
      });
    });

    it('ignores an explicit request to filter by SYSTEM type', async () => {
      await service.findMany(1, 20, { type: 'SYSTEM' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { type: { not: 'SYSTEM' }, status: 'ACTIVE' },
      });
    });

    it('still applies a real type filter', async () => {
      await service.findMany(1, 20, { type: 'HOSPITAL' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { type: 'HOSPITAL', status: 'ACTIVE' },
      });
    });
  });

  describe('getActiveOrganizations', () => {
    it('always excludes the internal SYSTEM placeholder org', async () => {
      await service.getActiveOrganizations(1, 20);

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', type: { not: 'SYSTEM' } },
      });
    });

    it('ignores an explicit request to discover SYSTEM-type orgs', async () => {
      await service.getActiveOrganizations(1, 20, { type: 'SYSTEM' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', type: { not: 'SYSTEM' } },
      });
    });

    it('still applies a real type filter', async () => {
      await service.getActiveOrganizations(1, 20, { type: 'HOSPITAL' as never });

      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', type: 'HOSPITAL' },
      });
    });
  });
});
