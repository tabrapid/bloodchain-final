import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AcknowledgeRecallDto,
  CloseRecallDto,
  ListRecallsDto,
  OpenRecallDto,
  UpdateRecallComponentDto,
} from './dto/recall.dto';
import { RecallService } from './recall.service';

const RECALL_ROLE_LIST = [
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
  RoleCode.HOSPITAL_ADMIN,
  RoleCode.HOSPITAL_STAFF,
] as const;

/**
 * Recall and look-back routes.
 *
 * Hospitals are here as well as blood centres, deliberately: a recall that only
 * the organisation which opened it can see has not been communicated to
 * anybody. What differs between them is not access to the route but what the
 * response contains, which the service decides from the components each
 * organisation actually holds.
 */
@ApiTags('Recall and look-back')
@Controller('organizations/:organizationId/recalls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecallController {
  constructor(private readonly recalls: RecallService) {}

  @Get()
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'Recalls this organization opened or holds components for' })
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListRecallsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.recalls.listCases(organizationId, userId, query);
  }

  @Get(':recallCaseId')
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'One recall case, as this organization may see it' })
  get(
    @Param('organizationId') organizationId: string,
    @Param('recallCaseId') recallCaseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.recalls.getCase(organizationId, recallCaseId, userId);
  }

  @Post('donations/:donationId')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Open a recall for every component of a donation' })
  open(
    @Param('organizationId') organizationId: string,
    @Param('donationId') donationId: string,
    @Body() dto: OpenRecallDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.recalls.openForDonation(
      organizationId,
      donationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':recallCaseId/acknowledge')
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'Acknowledge a recall and say what was done' })
  acknowledge(
    @Param('organizationId') organizationId: string,
    @Param('recallCaseId') recallCaseId: string,
    @Body() dto: AcknowledgeRecallDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.recalls.acknowledge(
      organizationId,
      recallCaseId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':recallCaseId/components/:componentId')
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'Record what became of one recalled component' })
  updateComponent(
    @Param('organizationId') organizationId: string,
    @Param('recallCaseId') recallCaseId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateRecallComponentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.recalls.updateComponentState(
      organizationId,
      recallCaseId,
      componentId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':recallCaseId/close')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Close a recall. Does not lift the holds it raised.' })
  close(
    @Param('organizationId') organizationId: string,
    @Param('recallCaseId') recallCaseId: string,
    @Body() dto: CloseRecallDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.recalls.close(
      organizationId,
      recallCaseId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }
}

/** Look-back and traceback, which are questions rather than actions. */
@ApiTags('Recall and look-back')
@Controller('organizations/:organizationId/traceability')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TraceabilityController {
  constructor(private readonly recalls: RecallService) {}

  @Get('donations/:donationId/forward')
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'Everything that came from one donation, and where it went' })
  forward(
    @Param('organizationId') organizationId: string,
    @Param('donationId') donationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.recalls.traceForward(organizationId, donationId, userId);
  }

  @Get('units/:bloodUnitId/back')
  @Roles(...RECALL_ROLE_LIST)
  @ApiOperation({ summary: 'From a component to the donation it came from, and no further' })
  back(
    @Param('organizationId') organizationId: string,
    @Param('bloodUnitId') bloodUnitId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.recalls.traceBack(organizationId, bloodUnitId, userId);
  }
}
