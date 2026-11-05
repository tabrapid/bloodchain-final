import { Test, TestingModule } from '@nestjs/testing';
import { HealthTrendsService } from './health-trends.service';
import { PrismaService } from '../../database/prisma.service';

describe('HealthTrendsService', () => {
  let service: HealthTrendsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    laboratoryResult: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    laboratoryResultItem: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    testReferenceRange: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    testParameter: {
      findFirst: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthTrendsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HealthTrendsService>(HealthTrendsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableParameters', () => {
    it('should return empty array when no results exist', async () => {
      mockPrismaService.laboratoryResult.findMany.mockResolvedValue([]);

      const result = await service.getAvailableParameters('user-123');

      expect(result).toEqual([]);
      expect(mockPrismaService.laboratoryResult.findMany).toHaveBeenCalledWith({
        where: { donorId: 'user-123', status: 'PUBLISHED' },
        select: expect.any(Object),
        orderBy: { performedAt: 'desc' },
      });
    });

    it('should return parameters with measurement counts', async () => {
      mockPrismaService.laboratoryResult.findMany.mockResolvedValue([
        {
          performedAt: new Date('2024-01-15'),
          items: [
            {
              parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', dataType: 'numeric', testType: { category: 'HEMATOLOGY' } },
              numericValue: 14.5,
            },
          ],
          laboratory: { name: 'Lab A' },
        },
        {
          performedAt: new Date('2024-02-15'),
          items: [
            {
              parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', dataType: 'numeric', testType: { category: 'HEMATOLOGY' } },
              numericValue: 14.0,
            },
          ],
          laboratory: { name: 'Lab A' },
        },
      ]);
      mockPrismaService.testReferenceRange.findMany.mockResolvedValue([]);

      const result = await service.getAvailableParameters('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]!.code).toBe('HEMOGLOBIN');
      expect(result[0]!.measurementCount).toBe(2);
      expect(result[0]!.latestValue).toBe(14.0);
    });
  });

  describe('getTrendData', () => {
    it('should return null when parameter is not provided', async () => {
      const result = await service.getTrendData('user-123', {});

      expect(result).toBeNull();
    });

    it('should return null when no data exists for parameter', async () => {
      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue([]);

      const result = await service.getTrendData('user-123', { parameter: 'HEMOGLOBIN' });

      expect(result).toBeNull();
    });

    it('should calculate trend correctly for increasing values', async () => {
      const mockItems = [
        {
          numericValue: BigInt(120),
          unit: 'g/dL',
          flag: 'NORMAL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', testType: { category: 'HEMATOLOGY' } },
          result: { id: '1', performedAt: new Date('2024-01-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
        {
          numericValue: BigInt(140),
          unit: 'g/dL',
          flag: 'NORMAL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', testType: { category: 'HEMATOLOGY' } },
          result: { id: '2', performedAt: new Date('2024-02-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
      ];

      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue(mockItems);
      mockPrismaService.testParameter.findFirst.mockResolvedValue({ testTypeId: 'tt-1' });
      mockPrismaService.testReferenceRange.findFirst.mockResolvedValue(null);

      const result = await service.getTrendData('user-123', { parameter: 'HEMOGLOBIN' });

      expect(result).not.toBeNull();
      expect(result?.latestValue).toBe(140);
      expect(result?.trend).toBe('INCREASING');
      expect(result?.points).toHaveLength(2);
    });

    it('should return STABLE when variation is within threshold', async () => {
      const mockItems = [
        {
          numericValue: BigInt(140),
          unit: 'g/dL',
          flag: 'NORMAL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', testType: { category: 'HEMATOLOGY' } },
          result: { id: '1', performedAt: new Date('2024-01-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
        {
          numericValue: BigInt(141),
          unit: 'g/dL',
          flag: 'NORMAL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', testType: { category: 'HEMATOLOGY' } },
          result: { id: '2', performedAt: new Date('2024-02-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
      ];

      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue(mockItems);
      mockPrismaService.testParameter.findFirst.mockResolvedValue({ testTypeId: 'tt-1' });
      mockPrismaService.testReferenceRange.findFirst.mockResolvedValue(null);

      const result = await service.getTrendData('user-123', { parameter: 'HEMOGLOBIN' });

      expect(result).not.toBeNull();
      expect(result?.trend).toBe('STABLE');
    });

    it('looks the reference range up for the parameter, not just the test type', async () => {
      // A Complete Blood Count carries one range per parameter. Matching on
      // the test type alone returned whichever range was created last -- the
      // platelet range under a haematocrit of 42.
      const mockItems = [
        {
          numericValue: BigInt(42),
          unit: '%',
          flag: 'NORMAL',
          parameter: { code: 'HEMATOCRIT', name: 'Hematocrit', unit: '%', testType: { category: 'HEMATOLOGY' } },
          result: { id: '1', performedAt: new Date('2024-01-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
      ];

      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue(mockItems);
      mockPrismaService.testParameter.findFirst.mockResolvedValue({ id: 'param-hct', testTypeId: 'tt-1' });
      mockPrismaService.testReferenceRange.findFirst.mockResolvedValue({ minValue: 36, maxValue: 52 });

      const result = await service.getTrendData('user-123', { parameter: 'HEMATOCRIT' });

      expect(mockPrismaService.testReferenceRange.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            testTypeId: 'tt-1',
            OR: [{ parameterId: 'param-hct' }, { parameterId: null }],
          }),
          orderBy: [{ parameterId: 'desc' }, { createdAt: 'desc' }],
        }),
      );
      expect(result?.referenceMin).toBe(36);
      expect(result?.referenceMax).toBe(52);
    });

    it('should return INSUFFICIENT_DATA when only one data point', async () => {
      const mockItems = [
        {
          numericValue: BigInt(140),
          unit: 'g/dL',
          flag: 'NORMAL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL', testType: { category: 'HEMATOLOGY' } },
          result: { id: '1', performedAt: new Date('2024-01-01'), laboratoryId: 'lab-1', laboratory: { name: 'Lab A' } },
        },
      ];

      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue(mockItems);
      mockPrismaService.testParameter.findFirst.mockResolvedValue({ testTypeId: 'tt-1' });
      mockPrismaService.testReferenceRange.findFirst.mockResolvedValue(null);

      const result = await service.getTrendData('user-123', { parameter: 'HEMOGLOBIN' });

      expect(result).not.toBeNull();
      expect(result?.trend).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('getParameterStatistics', () => {
    it('should return null when no data exists', async () => {
      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue([]);

      const result = await service.getParameterStatistics('user-123', 'HEMOGLOBIN');

      expect(result).toBeNull();
    });

    it('should calculate statistics correctly', async () => {
      const mockItems = [
        {
          numericValue: BigInt(120),
          unit: 'g/dL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL' },
          result: { performedAt: new Date('2024-01-01'), laboratory: { name: 'Lab A' } },
        },
        {
          numericValue: BigInt(140),
          unit: 'g/dL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL' },
          result: { performedAt: new Date('2024-02-01'), laboratory: { name: 'Lab A' } },
        },
        {
          numericValue: BigInt(130),
          unit: 'g/dL',
          parameter: { code: 'HEMOGLOBIN', name: 'Hemoglobin', unit: 'g/dL' },
          result: { performedAt: new Date('2024-03-01'), laboratory: { name: 'Lab A' } },
        },
      ];

      mockPrismaService.laboratoryResultItem.findMany.mockResolvedValue(mockItems);

      const result = await service.getParameterStatistics('user-123', 'HEMOGLOBIN');

      expect(result).not.toBeNull();
      expect(result?.measurementCount).toBe(3);
      expect(result?.minimum).toBe(120);
      expect(result?.maximum).toBe(140);
      expect(result?.average).toBe(130);
      expect(result?.firstValue).toBe(120);
      expect(result?.latest).toBe(130);
    });
  });

  describe('getSummary', () => {
    it('should return summary with zero counts when no data', async () => {
      mockPrismaService.laboratoryResult.findMany.mockResolvedValue([]);
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);
      mockPrismaService.laboratoryResult.findMany.mockResolvedValue([]);
      mockPrismaService.testReferenceRange.findMany.mockResolvedValue([]);

      const result = await service.getSummary('user-123', {});

      expect(result.totalTests).toBe(0);
      expect(result.totalParameters).toBe(0);
      expect(result.availableParameters).toEqual([]);
    });
  });

  describe('date range parsing', () => {
    it('should parse 1M range correctly', () => {
      const range = (service as any).parseDateRange('1M');
      expect(range).not.toBeNull();
      const now = new Date();
      const expectedFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      expect(range?.from.getDate()).toBe(expectedFrom.getDate());
    });

    it('should return null for ALL range', () => {
      const range = (service as any).parseDateRange('ALL');
      expect(range).toBeNull();
    });

    it('should return null for invalid range', () => {
      const range = (service as any).parseDateRange('INVALID');
      expect(range).toBeNull();
    });
  });
});
