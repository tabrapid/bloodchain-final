import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Check API and database health' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async check() {
    let database: 'up' | 'down' = 'up';
    if (!this.prisma.isConnected()) {
      database = 'down';
    } else {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'down';
      }
    }

    return {
      data: {
        status: database === 'up' ? 'ok' : 'degraded',
        database,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? '0.1.0',
      },
    };
  }
}
