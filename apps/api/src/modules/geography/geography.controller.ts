import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WrapResponseInterceptor } from '../../common/interceptors/wrap-response.interceptor';
import { GeographyService } from './geography.service';

/**
 * Reference geography, read-only.
 *
 * Authenticated but unrestricted by role: a donor picking a region and an
 * administrator editing an organization need exactly the same list, and it is
 * public administrative data either way.
 */
@ApiTags('Geography')
@Controller('geography')
@UseGuards(JwtAuthGuard)
// Every route here returns a raw payload, so the whole controller is wrapped:
// the clients unwrap `json.data`, and without this they received `undefined`
// and rendered an empty region picker with no error to explain it.
@UseInterceptors(WrapResponseInterceptor)
@ApiBearerAuth()
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get('regions')
  @ApiOperation({ summary: 'List the regions of Uzbekistan (ISO 3166-2:UZ)' })
  @ApiResponse({ status: 200, description: 'All 14 regions, with district counts' })
  regions() {
    return this.geography.listRegions();
  }

  @Get('districts')
  @ApiOperation({ summary: 'List districts, optionally within one region' })
  @ApiQuery({ name: 'regionId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Districts. Each row carries its `source`; DEMO rows are not authoritative.',
  })
  districts(@Query('regionId') regionId?: string) {
    return this.geography.listDistricts(regionId || undefined);
  }

  @Get('coverage')
  @ApiOperation({ summary: 'How much of the geography reference data is authoritative' })
  @ApiResponse({ status: 200, description: 'Counts by source, for a client that wants to say so' })
  coverage() {
    return this.geography.describeCoverage();
  }
}
