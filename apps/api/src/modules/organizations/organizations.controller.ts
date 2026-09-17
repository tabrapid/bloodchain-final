import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WrapResponseInterceptor } from '../../common/interceptors/wrap-response.interceptor';
import {
  DiscoverOrganizationsQueryDto,
  OrganizationDirectoryQueryDto,
  SetOrganizationVerificationDto,
  UpdateOrganizationDirectoryDto,
} from './dto/organization-directory.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /*
   * Three of the five routes below carry `@UseInterceptors(WrapResponseInterceptor)`
   * and two do not, which looks arbitrary and is not: `findMany` and `discover`
   * return `{ data, meta }` from the service itself, so wrapping them would
   * produce `{ data: { data, meta } }` and break the clients that already work.
   * The other three return a bare entity, which every client then unwraps as
   * `json.data` and got `undefined` for -- the whole directory UI rendered
   * empty without a single error anywhere. The interceptor cannot go on the
   * class for exactly that reason.
   */

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'The organization directory (staff)' })
  @ApiResponse({ status: 200, description: 'Paginated directory entries' })
  list(@Query() query: OrganizationDirectoryQueryDto) {
    return this.organizations.findMany(query);
  }

  /**
   * Donor-facing discovery. No role restriction beyond being signed in: this is
   * the list a donor picks a donation site from, and it only ever returns
   * ACTIVE organizations regardless of what the caller asks for.
   */
  @Get('discover')
  @ApiOperation({ summary: 'Discover active organizations, by geography, service or radius' })
  @ApiResponse({ status: 200, description: 'Active organizations, nearest first when a radius is given' })
  discover(@Query() query: DiscoverOrganizationsQueryDto) {
    return this.organizations.discover(query);
  }

  @Get(':id')
  @UseInterceptors(WrapResponseInterceptor)
  @ApiOperation({ summary: 'One organization, with its full directory entry' })
  @ApiResponse({ status: 200, description: 'Organization found' })
  findOne(@Param('id') id: string) {
    return this.organizations.findById(id);
  }

  /**
   * Directory edits. A hospital or blood-centre administrator may edit their
   * own organization; a platform administrator may edit any. The membership
   * check lives in the service, not here, so it cannot be bypassed by a second
   * caller arriving through a different route.
   */
  @Patch(':id/directory')
  @UseInterceptors(WrapResponseInterceptor)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Update an organization directory entry' })
  @ApiResponse({ status: 200, description: 'Updated directory entry' })
  @ApiResponse({ status: 403, description: 'Not a member of that organization' })
  async updateDirectory(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationDirectoryDto,
    @CurrentUser('sub') userId: string,
  ) {
    const editable = await this.organizations.editableOrganizationIds(userId);
    return this.organizations.updateDirectory(id, body, editable);
  }

  /**
   * Verification is a platform-administrator judgement about whether an
   * organization is real. Kept off the directory edit deliberately: an
   * organization must not be able to verify itself by saving its own address.
   */
  @Patch(':id/verification')
  @UseInterceptors(WrapResponseInterceptor)
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark an organization verified, or withdraw verification' })
  @ApiResponse({ status: 200, description: 'Updated organization' })
  setVerification(
    @Param('id') id: string,
    @Body() body: SetOrganizationVerificationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.organizations.setVerification(id, body.verified, userId);
  }
}
