import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

/** One unfinished row here means a migration died part-way through. */
interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

export interface DatabaseProbe {
  reachable: boolean;
  /** Null when the migration table could not be read at all. */
  migrationsApplied: boolean | null;
  latestMigration: string | null;
  /** Migrations that started and never finished, or were rolled back. */
  unfinishedMigrations: string[];
}

/**
 * Three endpoints, because an orchestrator asks three different questions and
 * this used to answer all of them the same way.
 *
 * `GET /health` answered `200 OK` with `status: "degraded"` when the database
 * was unreachable. Every load balancer, every Kubernetes readiness probe and
 * the Docker healthcheck in this repository decide by HTTP status code, so an
 * API that could not reach its database stayed in rotation, kept accepting
 * traffic, and kept failing every request — while reporting itself healthy to
 * anything that was watching. The body said "degraded" and nothing read it.
 *
 * The distinction that matters in production:
 *
 * - **Liveness** — "is this process wedged? should you restart it?" A database
 *   outage must answer YES, I am alive. Restarting the API does not fix a
 *   database, and a probe that conflates the two turns a five-minute database
 *   blip into a crash loop across every replica.
 * - **Readiness** — "can this instance serve a request right now?" A database
 *   outage must answer NO, so the instance leaves the load balancer and comes
 *   back on its own when the database does.
 *
 * `/health` keeps its existing shape and its existing path, because the demo
 * scripts, the Compose healthcheck and the mobile app's reachability probe all
 * use it. What changes is that it now sets the status code its body always
 * claimed.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Is the database reachable, and is its schema in a state we can serve?
   *
   * The migration check is not decoration. An API deployed ahead of its
   * migrations fails at runtime in ways that read as application bugs — a
   * column that does not exist, surfaced from somewhere deep in a request — and
   * a migration that died part-way leaves the schema in a state nobody
   * designed. Both are worth refusing traffic over, and both are invisible to
   * `SELECT 1`.
   */
  private async probeDatabase(): Promise<DatabaseProbe> {
    if (!this.prisma.isConnected()) {
      return { reachable: false, migrationsApplied: null, latestMigration: null, unfinishedMigrations: [] };
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      return { reachable: false, migrationsApplied: null, latestMigration: null, unfinishedMigrations: [] };
    }

    try {
      const rows = await this.prisma.$queryRaw<MigrationRow[]>`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at DESC
        LIMIT 50
      `;

      const unfinished = rows
        .filter((row) => row.finished_at === null || row.rolled_back_at !== null)
        .map((row) => row.migration_name);

      const latest = rows.find((row) => row.finished_at !== null && row.rolled_back_at === null);

      return {
        reachable: true,
        migrationsApplied: unfinished.length === 0,
        latestMigration: latest?.migration_name ?? null,
        unfinishedMigrations: unfinished,
      };
    } catch {
      // The database answers but the migration table cannot be read — a
      // database that was never migrated, or a role without access to it.
      // Reachable, but not something to send traffic to, and `null` says we
      // could not tell rather than pretending we could.
      return { reachable: true, migrationsApplied: null, latestMigration: null, unfinishedMigrations: [] };
    }
  }

  /**
   * The general health endpoint. Same body as before; correct status code now.
   *
   * 200 when the database is reachable, 503 when it is not — which is what the
   * Compose healthcheck and the mobile app's reachability probe have always
   * assumed they were getting.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'API and database health' })
  @ApiResponse({ status: 200, description: 'Healthy' })
  @ApiResponse({ status: 503, description: 'The database is unreachable' })
  async check(@Res({ passthrough: true }) res: Response) {
    const probe = await this.probeDatabase();
    const database: 'up' | 'down' = probe.reachable ? 'up' : 'down';

    res.status(probe.reachable ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      data: {
        status: probe.reachable ? 'ok' : 'degraded',
        database,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? '0.1.0',
      },
    };
  }

  /**
   * Liveness. Deliberately checks nothing but that this process is answering.
   *
   * It must not touch the database. A liveness probe that fails during a
   * database outage restarts every replica, repeatedly, for the duration of the
   * outage — which removes the thing that would have recovered on its own.
   */
  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness: is this process answering? Never checks the database.' })
  @ApiResponse({ status: 200, description: 'The process is alive' })
  live() {
    return {
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      },
    };
  }

  /**
   * Readiness. Can this instance serve a request right now?
   *
   * 503 takes the instance out of the load balancer without restarting it,
   * which is the correct response to a dependency being down: the instance is
   * fine, its dependency is not, and it will start answering again by itself.
   */
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness: database reachable and schema migrated' })
  @ApiResponse({ status: 200, description: 'Ready to serve traffic' })
  @ApiResponse({ status: 503, description: 'Not ready — database unreachable or migrations incomplete' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const probe = await this.probeDatabase();
    const ready = probe.reachable && probe.migrationsApplied === true;

    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      data: {
        status: ready ? 'ready' : 'not_ready',
        database: probe.reachable ? 'up' : 'down',
        // `null` means the migration table could not be read, which is not the
        // same as "migrations are missing" and is not reported as if it were.
        migrations:
          probe.migrationsApplied === null ? 'unknown' : probe.migrationsApplied ? 'applied' : 'incomplete',
        latestMigration: probe.latestMigration,
        unfinishedMigrations: probe.unfinishedMigrations,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
