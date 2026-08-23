import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  GetCampaignsDto,
  CampaignResponseDto,
  CampaignListResponseDto,
} from './dto/campaigns.dto';

@ApiTags('Campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Create a new campaign (organization staff only)' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully', type: CampaignResponseDto })
  async createCampaign(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    const membership = await this.getUserOrganization(userId);
    return this.campaignsService.createCampaign(membership.organizationId, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Update a campaign (organization staff only)' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully', type: CampaignResponseDto })
  async updateCampaign(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const membership = await this.getUserOrganization(userId);
    return this.campaignsService.updateCampaign(id, membership.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns' })
  @ApiResponse({ status: 200, description: 'Campaigns retrieved successfully', type: CampaignListResponseDto })
  async getCampaigns(@Query() query: GetCampaignsDto) {
    return this.campaignsService.getCampaigns(
      query.page,
      query.limit,
      query.status,
      query.organizationId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved successfully', type: CampaignResponseDto })
  async getCampaign(@Param('id') id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a campaign' })
  @ApiResponse({ status: 201, description: 'Joined campaign successfully' })
  async joinCampaign(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaignsService.joinCampaign(id, userId);
  }

  @Delete(':id/leave')
  @ApiOperation({ summary: 'Leave a campaign' })
  @ApiResponse({ status: 200, description: 'Left campaign successfully' })
  async leaveCampaign(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaignsService.leaveCampaign(id, userId);
  }

  @Get('my/campaigns')
  @ApiOperation({ summary: 'Get campaigns I am participating in' })
  @ApiResponse({ status: 200, description: 'User campaigns retrieved successfully' })
  async getUserCampaigns(
    @CurrentUser('sub') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.campaignsService.getUserCampaigns(userId, page, limit);
  }

  private async getUserOrganization(userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        organizationId: true,
      },
    });

    if (!membership) {
      throw new Error('User is not a member of any organization');
    }

    return membership;
  }
}
