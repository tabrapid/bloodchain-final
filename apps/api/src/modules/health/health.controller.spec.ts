import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { HealthController } from './health.controller';

/**
 * What an orchestrator is told, and the status code it decides by.
 *
 * The failure these exist to prevent: `/health` answered `200 OK` with a body
 * saying `degraded` while the database was unreachable. Load balancers, the
 * Kubernetes readiness probe and this repository's own Compose healthcheck all
 * decide by status code, so a broken API stayed in rotation and kept failing
 * every request it was sent — while reporting itself healthy.
 */
describe('HealthController', () => {
  let controller: HealthController;
  let prisma: Partial<PrismaService>;
  let res: Response;
  let status: number | undefined;

  /** Enough of an express Response to capture the status code. */
  function responseDouble(): Response {
    return {
      status: (code: number) => {
        status = code;
        return res;
      },
    } as unknown as Response;
  }

  const MIGRATIONS = [
    { migration_name: '20260920_latest', finished_at: new Date(), rolled_back_at: null },
    { migration_name: '20260919_earlier', finished_at: new Date(), rolled_back_at: null },
  ];

  beforeEach(async () => {
    status = undefined;
    prisma = {
      isConnected: jest.fn().mockReturnValue(true),
      // `SELECT 1` and the migration query both go through $queryRaw; the
      // default returns the migration rows, and the connectivity probe does not
      // care what comes back.
      $queryRaw: jest.fn().mockResolvedValue(MIGRATIONS),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    res = responseDouble();
  });

  describe('GET /health', () => {
    it('returns ok, and 200, when the database is reachable', async () => {
      const result = await controller.check(res);

      expect(result.data.status).toBe('ok');
      expect(result.data.database).toBe('up');
      expect(status).toBe(200);
    });

    it('returns degraded, and 503, when the database fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('db down'));

      const result = await controller.check(res);

      expect(result.data.status).toBe('degraded');
      expect(result.data.database).toBe('down');
      // The part that was wrong: the body said degraded and the status code
      // said fine, so nothing acted on it.
      expect(status).toBe(503);
    });

    it('returns degraded, and 503, when prisma never connected', async () => {
      (prisma.isConnected as jest.Mock).mockReturnValue(false);

      const result = await controller.check(res);

      expect(result.data.status).toBe('degraded');
      expect(status).toBe(503);
    });

    it('keeps the body shape every existing client reads', async () => {
      // The demo scripts, the Compose healthcheck and the mobile app's
      // reachability probe all parse this. Only the status code changed.
      const result = await controller.check(res);

      expect(Object.keys(result.data).sort()).toEqual(['database', 'status', 'timestamp', 'version']);
    });
  });

  describe('GET /health/live', () => {
    it('is alive without touching the database', () => {
      const result = controller.live();

      expect(result.data.status).toBe('alive');
      // The whole point. A liveness probe that fails during a database outage
      // restarts every replica repeatedly, for the length of the outage.
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.isConnected).not.toHaveBeenCalled();
    });

    it('reports uptime, so a crash loop is visible from the probe itself', () => {
      expect(typeof controller.live().data.uptimeSeconds).toBe('number');
    });
  });

  describe('GET /health/ready', () => {
    it('is ready, and 200, when the database is up and migrated', async () => {
      const result = await controller.ready(res);

      expect(result.data.status).toBe('ready');
      expect(result.data.migrations).toBe('applied');
      expect(result.data.latestMigration).toBe('20260920_latest');
      expect(status).toBe(200);
    });

    it('is not ready, and 503, when the database is unreachable', async () => {
      (prisma.isConnected as jest.Mock).mockReturnValue(false);

      const result = await controller.ready(res);

      expect(result.data.status).toBe('not_ready');
      expect(status).toBe(503);
    });

    it('is not ready when a migration started and never finished', async () => {
      // A half-applied migration leaves the schema in a state nobody designed,
      // and `SELECT 1` cannot see it.
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { migration_name: '20260921_half_applied', finished_at: null, rolled_back_at: null },
        ...MIGRATIONS,
      ]);

      const result = await controller.ready(res);

      expect(result.data.status).toBe('not_ready');
      expect(result.data.migrations).toBe('incomplete');
      expect(result.data.unfinishedMigrations).toContain('20260921_half_applied');
      expect(status).toBe(503);
    });

    it('is not ready when a migration was rolled back', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { migration_name: '20260921_rolled_back', finished_at: new Date(), rolled_back_at: new Date() },
      ]);

      const result = await controller.ready(res);

      expect(result.data.migrations).toBe('incomplete');
      expect(status).toBe(503);
    });

    it('says "unknown" rather than guessing when the migration table cannot be read', async () => {
      // A database that answers but has never been migrated, or a role with no
      // access to the table. Reporting that as "incomplete" would be a claim we
      // cannot support; reporting it as "applied" would be worse.
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([1]) // SELECT 1 succeeds
        .mockRejectedValueOnce(new Error('relation "_prisma_migrations" does not exist'));

      const result = await controller.ready(res);

      expect(result.data.database).toBe('up');
      expect(result.data.migrations).toBe('unknown');
      // Unknown is not ready. Fail closed, like everything else here.
      expect(result.data.status).toBe('not_ready');
      expect(status).toBe(503);
    });
  });
});
