import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: Partial<PrismaService>;

  beforeEach(async () => {
    prisma = {
      isConnected: jest.fn().mockReturnValue(true),
      $queryRaw: jest.fn().mockResolvedValue([1]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok when database is reachable', async () => {
    const result = await controller.check();
    expect(result.data.status).toBe('ok');
    expect(result.data.database).toBe('up');
  });

  it('returns degraded when database fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('db down'));
    const result = await controller.check();
    expect(result.data.status).toBe('degraded');
    expect(result.data.database).toBe('down');
  });

  it('returns degraded when prisma never connected', async () => {
    (prisma.isConnected as jest.Mock).mockReturnValue(false);
    const result = await controller.check();
    expect(result.data.status).toBe('degraded');
    expect(result.data.database).toBe('down');
  });
});
