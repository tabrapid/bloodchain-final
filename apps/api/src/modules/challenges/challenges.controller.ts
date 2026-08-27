import {
  Controller,
  Get,
  Post,
  Put,
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
import { ChallengesService } from './challenges.service';
import {
  CreateChallengeDto,
  UpdateChallengeDto,
  GetChallengesDto,
  ChallengeResponseDto,
  ChallengeListResponseDto,
} from './dto/challenges.dto';

@ApiTags('Challenges')
@Controller('challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Create a new challenge (admin only)' })
  @ApiResponse({ status: 201, description: 'Challenge created successfully', type: ChallengeResponseDto })
  async createChallenge(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateChallengeDto,
  ) {
    return this.challengesService.createChallenge(dto, userId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Update a challenge (admin only)' })
  @ApiResponse({ status: 200, description: 'Challenge updated successfully', type: ChallengeResponseDto })
  async updateChallenge(
    @Param('id') id: string,
    @Body() dto: UpdateChallengeDto,
  ) {
    return this.challengesService.updateChallenge(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all challenges' })
  @ApiResponse({ status: 200, description: 'Challenges retrieved successfully', type: ChallengeListResponseDto })
  async getChallenges(@Query() query: GetChallengesDto) {
    return this.challengesService.getChallenges(
      query.page,
      query.limit,
      query.type,
      query.status,
      query.visibility,
    );
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active challenges for current user' })
  @ApiResponse({ status: 200, description: 'Active challenges retrieved successfully' })
  async getActiveChallenges(@CurrentUser('sub') userId: string) {
    return this.challengesService.getActiveChallenges(userId);
  }

  @Get('my/challenges')
  @ApiOperation({ summary: 'Get challenges I am participating in' })
  @ApiResponse({ status: 200, description: 'User challenges retrieved successfully' })
  async getUserChallenges(
    @CurrentUser('sub') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.challengesService.getUserChallenges(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get challenge by ID' })
  @ApiResponse({ status: 200, description: 'Challenge retrieved successfully', type: ChallengeResponseDto })
  async getChallenge(@Param('id') id: string) {
    return this.challengesService.getChallenge(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a challenge' })
  @ApiResponse({ status: 201, description: 'Joined challenge successfully' })
  async joinChallenge(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.challengesService.joinChallenge(id, userId);
  }

  @Put(':id/progress')
  @ApiOperation({ summary: "Recalculate the current user's progress on a challenge from their real activity records" })
  @ApiResponse({ status: 201, description: 'Progress recalculated successfully' })
  async recalculateProgress(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.challengesService.recalculateProgress(id, userId);
  }
}
