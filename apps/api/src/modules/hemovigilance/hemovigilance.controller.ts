import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CloseHemovigilanceEventDto,
  InvestigateHemovigilanceEventDto,
  ListHemovigilanceEventsDto,
  ReportHemovigilanceEventDto,
} from './dto/hemovigilance.dto';
import { HemovigilanceService } from './hemovigilance.service';

const HEMOVIGILANCE_ROLE_LIST = [
  RoleCode.HOSPITAL_ADMIN,
  RoleCode.HOSPITAL_STAFF,
  RoleCode.BLOOD_CENTER_ADMIN,
  RoleCode.BLOOD_CENTER_STAFF,
] as const;

@ApiTags('Hemovigilance')
@Controller('organizations/:organizationId/hemovigilance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HemovigilanceController {
  constructor(private readonly hemovigilance: HemovigilanceService) {}

  @Get('events')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Events this organization reported' })
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListHemovigilanceEventsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.hemovigilance.listOwn(organizationId, userId, query);
  }

  @Post('events')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Report a transfusion-related event' })
  report(
    @Param('organizationId') organizationId: string,
    @Body() dto: ReportHemovigilanceEventDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.hemovigilance.report(
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('events/:eventId/investigate')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Record investigation progress' })
  investigate(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Body() dto: InvestigateHemovigilanceEventDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.hemovigilance.investigate(
      organizationId,
      eventId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('events/:eventId/close')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Close an event. Changes nothing about the component.' })
  close(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CloseHemovigilanceEventDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.hemovigilance.close(
      organizationId,
      eventId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('events/:eventId/link/:recallCaseId')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Link an event to a recall so a look-back finds both' })
  link(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Param('recallCaseId') recallCaseId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.hemovigilance.linkToRecall(
      organizationId,
      eventId,
      recallCaseId,
      userId,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Get('recalls/:recallCaseId/events')
  @Roles(...HEMOVIGILANCE_ROLE_LIST)
  @ApiOperation({ summary: 'Events linked to a recall, in the narrow cross-organization view' })
  forRecall(
    @Param('organizationId') organizationId: string,
    @Param('recallCaseId') recallCaseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.hemovigilance.listForRecall(organizationId, recallCaseId, userId);
  }
}
