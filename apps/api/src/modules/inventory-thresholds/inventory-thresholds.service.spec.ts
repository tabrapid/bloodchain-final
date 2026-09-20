import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  DEVELOPMENT_LOW_STOCK_THRESHOLD,
  InventoryThresholdsService,
} from './inventory-thresholds.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    organizationId: 'org-1',
    scopeKey: 'ORG',
    bloodType: null,
    rhFactor: null,
    componentType: null,
    lowStockThreshold: 10,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

/**
 * Sprint 7 safety test 12, plus the resolution order it depends on.
 *
 * The number this service answers with used to be `5`, for every organisation
 * and every blood group at once. What matters now is that the answer is a
 * property of the organisation asking, that the most specific configuration
 * wins, and that production never falls back to a number nobody chose.
 */
describe('InventoryThresholdsService', () => {
  let service: InventoryThresholdsService;
  let prisma: any;
  let audit: any;
  let nodeEnv: string;

  async function build() {
    prisma = {
      inventoryThreshold: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async ({ create }: any) => row(create)),
        delete: jest.fn().mockResolvedValue({}),
      },
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue([
          { organizationId: 'org-1', role: { code: 'BLOOD_CENTER_ADMIN' } },
        ]),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryThresholdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)) },
        },
      ],
    }).compile();

    service = module.get(InventoryThresholdsService);
  }

  beforeEach(async () => {
    nodeEnv = 'development';
    await build();
  });

  describe('resolution', () => {
    it('is organisation-specific: two organisations get their own answers', async () => {
      prisma.inventoryThreshold.findMany.mockImplementation(async ({ where }: any) =>
        where.organizationId === 'org-1'
          ? [row({ organizationId: 'org-1', scopeKey: 'ORG', lowStockThreshold: 10 })]
          : [row({ organizationId: 'org-2', scopeKey: 'ORG', lowStockThreshold: 40 })],
      );

      const first = await service.resolve('org-1', { bloodType: 'O', rhFactor: 'NEGATIVE' });
      const second = await service.resolve('org-2', { bloodType: 'O', rhFactor: 'NEGATIVE' });

      expect(first.threshold).toBe(10);
      expect(second.threshold).toBe(40);
    });

    it('prefers a blood-group row over the organisation default', () => {
      const rows = [
        row({ scopeKey: 'ORG', lowStockThreshold: 10 }),
        row({ scopeKey: 'TYPE:O:NEGATIVE', bloodType: 'O', rhFactor: 'NEGATIVE', lowStockThreshold: 25 }),
      ];

      const resolved = service.resolveFrom(rows, { bloodType: 'O', rhFactor: 'NEGATIVE' });

      expect(resolved.threshold).toBe(25);
      expect(resolved.scopeKey).toBe('TYPE:O:NEGATIVE');
    });

    it('prefers a component row over the blood-group row', () => {
      const rows = [
        row({ scopeKey: 'ORG', lowStockThreshold: 10 }),
        row({ scopeKey: 'TYPE:O:NEGATIVE', bloodType: 'O', rhFactor: 'NEGATIVE', lowStockThreshold: 25 }),
        row({
          scopeKey: 'TYPE:O:NEGATIVE:PLATELETS',
          bloodType: 'O',
          rhFactor: 'NEGATIVE',
          componentType: 'PLATELETS',
          lowStockThreshold: 3,
        }),
      ];

      const resolved = service.resolveFrom(rows, {
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
        componentType: 'PLATELETS',
      });

      expect(resolved.threshold).toBe(3);
    });

    it('falls back to the organisation default for a group with no row of its own', () => {
      const rows = [
        row({ scopeKey: 'ORG', lowStockThreshold: 10 }),
        row({ scopeKey: 'TYPE:O:NEGATIVE', bloodType: 'O', rhFactor: 'NEGATIVE', lowStockThreshold: 25 }),
      ];

      expect(service.resolveFrom(rows, { bloodType: 'AB', rhFactor: 'POSITIVE' }).threshold).toBe(10);
    });

    it('uses the development fallback outside production, and labels it', () => {
      const resolved = service.resolveFrom([], { bloodType: 'O', rhFactor: 'NEGATIVE' });

      expect(resolved.threshold).toBe(DEVELOPMENT_LOW_STOCK_THRESHOLD);
      expect(resolved.source).toBe('DEVELOPMENT_FALLBACK');
    });

    it('answers nothing at all in production when nothing is configured', async () => {
      nodeEnv = 'production';
      await build();

      const resolved = service.resolveFrom([], { bloodType: 'O', rhFactor: 'NEGATIVE' });

      // Not zero, not five, not a guess. The alert engine reads this as "there
      // is no threshold to compare against" and says so to staff.
      expect(resolved.threshold).toBeNull();
      expect(resolved.source).toBe('NOT_CONFIGURED');
    });
  });

  describe('scope keys', () => {
    it('collapses a half-specified blood group to the organisation default', () => {
      expect(InventoryThresholdsService.scopeKeyFor({ bloodType: 'O' })).toBe('ORG');
      expect(InventoryThresholdsService.scopeKeyFor({ rhFactor: 'NEGATIVE' })).toBe('ORG');
    });

    it('distinguishes the three levels', () => {
      expect(InventoryThresholdsService.scopeKeyFor({})).toBe('ORG');
      expect(
        InventoryThresholdsService.scopeKeyFor({ bloodType: 'O', rhFactor: 'NEGATIVE' }),
      ).toBe('TYPE:O:NEGATIVE');
      expect(
        InventoryThresholdsService.scopeKeyFor({
          bloodType: 'O',
          rhFactor: 'NEGATIVE',
          componentType: 'PLASMA',
        }),
      ).toBe('TYPE:O:NEGATIVE:PLASMA');
    });
  });

  describe('upsert', () => {
    it('refuses half a blood group', async () => {
      await expect(
        service.upsert('org-1', 'admin-1', { bloodType: 'O', lowStockThreshold: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a component scope with no blood group', async () => {
      await expect(
        service.upsert('org-1', 'admin-1', { componentType: 'PLASMA', lowStockThreshold: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a negative threshold', async () => {
      await expect(
        service.upsert('org-1', 'admin-1', { lowStockThreshold: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('audits the change, including what the number was before', async () => {
      prisma.inventoryThreshold.findUnique.mockResolvedValue(row({ lowStockThreshold: 20 }));

      await service.upsert('org-1', 'admin-1', { lowStockThreshold: 2 });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVENTORY_THRESHOLD_UPDATED',
          metadata: expect.objectContaining({ previousThreshold: 20, lowStockThreshold: 2 }),
        }),
      );
    });

    it('refuses staff who are not administrators of the organisation', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: 'org-1', role: { code: 'BLOOD_CENTER_STAFF' } },
      ]);

      await expect(service.upsert('org-1', 'staff-1', { lowStockThreshold: 2 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
