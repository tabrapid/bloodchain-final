import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BloodType,
  DonorStatus,
  EmergencyMatchStatus,
  EmergencyResponseStatus,
  EmergencyStatus,
  OrganizationType,
  Prisma,
  RhFactor,
  RoleCode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const BLOOD_COMPATIBILITY: Record<string, string[]> = {
  'O-NEGATIVE': ['O-NEGATIVE', 'O-POSITIVE', 'A-NEGATIVE', 'A-POSITIVE', 'B-NEGATIVE', 'B-POSITIVE', 'AB-NEGATIVE', 'AB-POSITIVE'],
  'O-POSITIVE': ['O-POSITIVE', 'A-POSITIVE', 'B-POSITIVE', 'AB-POSITIVE'],
  'A-NEGATIVE': ['A-NEGATIVE', 'A-POSITIVE', 'AB-NEGATIVE', 'AB-POSITIVE'],
  'A-POSITIVE': ['A-POSITIVE', 'AB-POSITIVE'],
  'B-NEGATIVE': ['B-NEGATIVE', 'B-POSITIVE', 'AB-NEGATIVE', 'AB-POSITIVE'],
  'B-POSITIVE': ['B-POSITIVE', 'AB-POSITIVE'],
  'AB-NEGATIVE': ['AB-NEGATIVE', 'AB-POSITIVE'],
  'AB-POSITIVE': ['AB-POSITIVE'],
};

const BLOOD_GROUP_KEY = (bloodType: BloodType, rhFactor: RhFactor) => `${bloodType}-${rhFactor}`;

@Injectable()
export class EmergencyService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  private generateEmergencyReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `SOS-${year}-${random}`;
  }

  async getAuthorizedUser(userId: string, organizationId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const membership = user.memberships.find(
      (m: { organizationId: string; status: string }) => m.organizationId === organizationId && m.status === 'ACTIVE',
    );

    if (!membership) {
      throw new ForbiddenException('You do not belong to this organization.');
    }

    return { user, membership };
  }

  async checkHospitalAccess(userId: string, organizationId: string) {
    const { user, membership } = await this.getAuthorizedUser(userId, organizationId);
    const org = await this.db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.type !== OrganizationType.HOSPITAL) {
      throw new ForbiddenException('Only hospitals can perform this action.');
    }
    const hasPermission = user.memberships.some(
      (m: { role: { code: string } }) =>
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN'].includes(m.role.code),
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return { user, membership };
  }

  async checkDonorAccess(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            role: true,
          },
        },
        donorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isDonor = user.memberships.some(
      (m: { role: { code: string } }) => m.role.code === RoleCode.DONOR,
    );

    if (!isDonor) {
      throw new ForbiddenException('Only donors can perform this action.');
    }

    return user;
  }

  isBloodCompatible(donorType: BloodType, donorRh: RhFactor, requiredType: BloodType, requiredRh: RhFactor): boolean {
    const donorKey = BLOOD_GROUP_KEY(donorType, donorRh);
    const requiredKey = BLOOD_GROUP_KEY(requiredType, requiredRh);
    const compatibleGroups = BLOOD_COMPATIBILITY[donorKey] || [];
    return compatibleGroups.includes(requiredKey);
  }

  async checkDonorEligibility(userId: string) {
    const user = await this.checkDonorAccess(userId);

    if (!user.donorProfile) {
      throw new ForbiddenException('Donor profile not found.');
    }

    if (user.donorProfile.donorStatus !== DonorStatus.ACTIVE) {
      throw new ForbiddenException('Donor is not active.');
    }

    if (!user.donorProfile.bloodType || !user.donorProfile.rhFactor) {
      throw new ForbiddenException('Donor blood type not verified.');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified.');
    }

    return user;
  }

  async createEmergency(
    organizationId: string,
    userId: string,
    dto: {
      bloodType: string;
      rhFactor: string;
      unitsRequired: number;
      urgencyLevel?: string;
      patientReference?: string;
      description?: string;
      requiredBefore?: string;
      donationLocation?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const { user } = await this.checkHospitalAccess(userId, organizationId);

    if (dto.unitsRequired < 1 || dto.unitsRequired > 20) {
      throw new BadRequestException('Units required must be between 1 and 20.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const emergency = await tx.emergencyRequest.create({
        data: {
          emergencyReference: this.generateEmergencyReference(),
          hospitalId: organizationId,
          bloodType: dto.bloodType as BloodType,
          rhFactor: dto.rhFactor as RhFactor,
          unitsRequired: dto.unitsRequired,
          urgencyLevel: dto.urgencyLevel || 'CRITICAL',
          status: EmergencyStatus.DRAFT,
          patientReference: dto.patientReference,
          description: dto.description,
          requiredBefore: dto.requiredBefore ? new Date(dto.requiredBefore) : undefined,
          donationLocation: dto.donationLocation,
          latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
          longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : undefined,
          createdBy: user.id,
        },
      });

      return emergency;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'EMERGENCY_CREATED',
      entityType: 'EmergencyRequest',
      entityId: result.id,
      organizationId,
      metadata: {
        emergencyReference: result.emergencyReference,
        bloodType: dto.bloodType,
        rhFactor: dto.rhFactor,
        unitsRequired: dto.unitsRequired,
        urgencyLevel: dto.urgencyLevel || 'CRITICAL',
      },
    });

    return result;
  }

  async activateEmergency(organizationId: string, userId: string, emergencyId: string) {
    const { user } = await this.checkHospitalAccess(userId, organizationId);

    const emergency = await this.db.emergencyRequest.findUnique({
      where: { id: emergencyId },
      include: { hospital: true },
    });

    if (!emergency) {
      throw new NotFoundException('Emergency request not found.');
    }

    if (emergency.hospitalId !== organizationId) {
      throw new ForbiddenException('This emergency does not belong to your organization.');
    }

    if (emergency.status !== EmergencyStatus.DRAFT) {
      throw new BadRequestException('Emergency can only be activated from DRAFT status.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.ACTIVE },
      });

      await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.MATCHING },
      });

      const donors = await tx.user.findMany({
        where: {
          memberships: {
            some: {
              role: { code: RoleCode.DONOR },
              status: 'ACTIVE',
            },
          },
          donorProfile: {
            bloodType: emergency.bloodType,
            rhFactor: emergency.rhFactor,
            donorStatus: DonorStatus.ACTIVE,
            verificationStatus: 'VERIFIED',
          },
          emailVerified: true,
        },
        include: {
          donorProfile: true,
          emergencyMatches: {
            where: {
              emergencyRequest: {
                status: {
                  in: [EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED],
                },
              },
            },
          },
          emergencyResponses: {
            where: {
              status: {
                notIn: [EmergencyResponseStatus.COMPLETED, EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED],
              },
            },
          },
        },
      });

      const compatibleDonors = donors.filter((donor) => {
        if (!donor.donorProfile || donor.emergencyMatches.length > 0 || donor.emergencyResponses.length > 0) {
          return false;
        }
        return this.isBloodCompatible(
          donor.donorProfile.bloodType,
          donor.donorProfile.rhFactor,
          emergency.bloodType,
          emergency.rhFactor,
        );
      });

      for (const donor of compatibleDonors.slice(0, 50)) {
        await tx.emergencyMatch.create({
          data: {
            emergencyRequestId: emergencyId,
            donorId: donor.id,
            status: EmergencyMatchStatus.MATCHED,
          },
        });
      }

      await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.MATCHING },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'EMERGENCY_ACTIVATED',
      entityType: 'EmergencyRequest',
      entityId: emergencyId,
      organizationId,
      metadata: { emergencyReference: emergency.emergencyReference },
    });

    return result;
  }

  async getEmergencies(organizationId: string, userId: string, filters?: { status?: string; urgencyLevel?: string }) {
    await this.checkHospitalAccess(userId, organizationId);

    const where: Prisma.EmergencyRequestWhereInput = {
      hospitalId: organizationId,
    };

    if (filters?.status) {
      where.status = filters.status as EmergencyStatus;
    }
    if (filters?.urgencyLevel) {
      where.urgencyLevel = filters.urgencyLevel;
    }

    const emergencies = await this.db.emergencyRequest.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true } },
        matches: { select: { id: true, status: true } },
        responses: { select: { id: true, status: true, donor: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: emergencies };
  }

  async getEmergency(organizationId: string, userId: string, emergencyId: string) {
    await this.checkHospitalAccess(userId, organizationId);

    const emergency = await this.db.emergencyRequest.findFirst({
      where: {
        id: emergencyId,
        hospitalId: organizationId,
      },
      include: {
        hospital: { select: { id: true, name: true, address: true } },
        matches: {
          include: {
            donor: { select: { id: true, firstName: true, lastName: true, donorProfile: { select: { bloodType: true, rhFactor: true } } } },
          },
        },
        responses: {
          include: {
            donor: { select: { id: true, firstName: true, lastName: true, donorProfile: { select: { bloodType: true, rhFactor: true } } } },
            locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!emergency) {
      throw new NotFoundException('Emergency request not found.');
    }

    return emergency;
  }

  async getDonorEmergencies(userId: string) {
    await this.checkDonorAccess(userId);

    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        emergencyMatches: {
          include: {
            emergencyRequest: {
              include: {
                hospital: { select: { id: true, name: true } },
              },
            },
          },
        },
        emergencyResponses: {
          include: {
            emergencyRequest: {
              include: {
                hospital: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.donorProfile) {
      throw new NotFoundException('Donor profile not found.');
    }

    const activeEmergencies = user.emergencyMatches
      .filter((m) => {
        const validStatuses = [EmergencyMatchStatus.MATCHED, EmergencyMatchStatus.NOTIFIED, EmergencyMatchStatus.VIEWED];
        return validStatuses.includes(m.status);
      })
      .filter((m) => {
        const req = m.emergencyRequest;
        return req.status === EmergencyStatus.ACTIVE || req.status === EmergencyStatus.MATCHING || req.status === EmergencyStatus.RESPONSES_RECEIVED;
      })
      .map((m) => ({
        ...m.emergencyRequest,
        matchId: m.id,
        matchStatus: m.status,
        canAccept: this.isBloodCompatible(
          user.donorProfile!.bloodType,
          user.donorProfile!.rhFactor,
          m.emergencyRequest.bloodType,
          m.emergencyRequest.rhFactor,
        ),
      }));

    const myResponses = user.emergencyResponses.map((r) => ({
      ...r.emergencyRequest,
      responseId: r.id,
      responseStatus: r.status,
      acceptedAt: r.acceptedAt,
      enRouteAt: r.enRouteAt,
      arrivedAt: r.arrivedAt,
    }));

    return { data: { active: activeEmergencies, myResponses } };
  }

  async viewEmergencyMatch(donorId: string, matchId: string) {
    const user = await this.checkDonorAccess(donorId);

    const match = await this.db.emergencyMatch.findUnique({
      where: { id: matchId },
      include: {
        emergencyRequest: {
          include: {
            hospital: { select: { id: true, name: true, address: true } },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    if (match.donorId !== donorId) {
      throw new ForbiddenException('This match does not belong to you.');
    }

    if (match.status !== EmergencyMatchStatus.MATCHED && match.status !== EmergencyMatchStatus.NOTIFIED) {
      throw new BadRequestException('Match is no longer active.');
    }

    await this.db.emergencyMatch.update({
      where: { id: matchId },
      data: { viewedAt: new Date(), status: EmergencyMatchStatus.VIEWED },
    });

    return match;
  }

  async acceptEmergency(donorId: string, matchId: string) {
    const user = await this.checkDonorEligibility(donorId);

    const match = await this.db.emergencyMatch.findUnique({
      where: { id: matchId },
      include: {
        emergencyRequest: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    if (match.donorId !== donorId) {
      throw new ForbiddenException('This match does not belong to you.');
    }

    const emergency = match.emergencyRequest;

    const activeStatuses = [EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED];
    if (!activeStatuses.includes(emergency.status)) {
      throw new BadRequestException('Emergency is no longer active.');
    }

    if (!this.isBloodCompatible(
      user.donorProfile!.bloodType!,
      user.donorProfile!.rhFactor!,
      emergency.bloodType,
      emergency.rhFactor,
    )) {
      throw new ForbiddenException('Blood types are not compatible.');
    }

    const existingResponse = await this.db.emergencyResponse.findFirst({
      where: {
        donorId,
        emergencyRequestId: emergency.id,
        status: { notIn: [EmergencyResponseStatus.COMPLETED, EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED] },
      },
    });

    if (existingResponse) {
      throw new ConflictException('You already have an active response for this emergency.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updatedMatch = await tx.emergencyMatch.update({
        where: { id: matchId },
        data: {
          status: EmergencyMatchStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      const response = await tx.emergencyResponse.create({
        data: {
          emergencyRequestId: emergency.id,
          matchId: matchId,
          donorId,
          status: EmergencyResponseStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      const responseCount = await tx.emergencyResponse.count({
        where: {
          emergencyRequestId: emergency.id,
          status: { notIn: [EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED] },
        },
      });

      if (responseCount > 0) {
        await tx.emergencyRequest.update({
          where: { id: emergency.id },
          data: { status: EmergencyStatus.RESPONSES_RECEIVED },
        });
      }

      return response;
    });

    await this.audit.log({
      actorId: donorId,
      action: 'EMERGENCY_ACCEPTED',
      entityType: 'EmergencyResponse',
      entityId: result.id,
      organizationId: emergency.hospitalId,
      metadata: { emergencyReference: emergency.emergencyReference },
    });

    return result;
  }

  async declineEmergency(donorId: string, matchId: string) {
    const match = await this.db.emergencyMatch.findUnique({
      where: { id: matchId },
      include: { emergencyRequest: true },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    if (match.donorId !== donorId) {
      throw new ForbiddenException('This match does not belong to you.');
    }

    await this.db.emergencyMatch.update({
      where: { id: matchId },
      data: { status: EmergencyMatchStatus.DECLINED },
    });

    return { success: true };
  }

  async startJourney(donorId: string, responseId: string) {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: { emergencyRequest: true },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    if (response.status !== EmergencyResponseStatus.ACCEPTED) {
      throw new BadRequestException('Response must be in ACCEPTED status to start journey.');
    }

    const result = await this.db.emergencyResponse.update({
      where: { id: responseId },
      data: {
        status: EmergencyResponseStatus.EN_ROUTE,
        enRouteAt: new Date(),
      },
    });

    await this.db.emergencyRequest.update({
      where: { id: response.emergencyRequestId },
      data: { status: EmergencyStatus.DONOR_EN_ROUTE },
    });

    return result;
  }

  async updateLocation(
    donorId: string,
    responseId: string,
    dto: { latitude: number; longitude: number; accuracy?: number; heading?: number; speed?: number },
  ) {
    if (dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException('Invalid latitude.');
    }
    if (dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Invalid longitude.');
    }

    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    if (response.status !== EmergencyResponseStatus.EN_ROUTE) {
      throw new BadRequestException('Location can only be updated when en route.');
    }

    const location = await this.db.emergencyLocation.create({
      data: {
        emergencyResponseId: responseId,
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
        accuracy: dto.accuracy ? new Prisma.Decimal(dto.accuracy) : undefined,
        heading: dto.heading ? new Prisma.Decimal(dto.heading) : undefined,
        speed: dto.speed ? new Prisma.Decimal(dto.speed) : undefined,
      },
    });

    return location;
  }

  async arriveAtHospital(donorId: string, responseId: string) {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: { emergencyRequest: true },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    if (response.status !== EmergencyResponseStatus.EN_ROUTE) {
      throw new BadRequestException('Response must be EN_ROUTE to arrive.');
    }

    const result = await this.db.emergencyResponse.update({
      where: { id: responseId },
      data: {
        status: EmergencyResponseStatus.ARRIVED,
        arrivedAt: new Date(),
      },
    });

    await this.db.emergencyRequest.update({
      where: { id: response.emergencyRequestId },
      data: { status: EmergencyStatus.DONOR_ARRIVED },
    });

    return result;
  }

  async confirmArrival(organizationId: string, userId: string, responseId: string) {
    await this.checkHospitalAccess(userId, organizationId);

    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: { emergencyRequest: true },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.emergencyRequest.hospitalId !== organizationId) {
      throw new ForbiddenException('This response does not belong to your organization.');
    }

    if (response.status !== EmergencyResponseStatus.ARRIVED) {
      throw new BadRequestException('Response must be ARRIVED to confirm.');
    }

    const result = await this.db.emergencyResponse.update({
      where: { id: responseId },
      data: {
        status: EmergencyResponseStatus.DONATION_STARTED,
        donationStartedAt: new Date(),
      },
    });

    await this.db.emergencyRequest.update({
      where: { id: response.emergencyRequestId },
      data: { status: EmergencyStatus.DONATION_STARTED },
    });

    return result;
  }

  async completeEmergency(donorId: string, responseId: string, donationId?: string) {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: { emergencyRequest: true },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    if (response.status !== EmergencyResponseStatus.DONATION_STARTED) {
      throw new BadRequestException('Response must be in DONATION_STARTED to complete.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.emergencyResponse.update({
        where: { id: responseId },
        data: {
          status: EmergencyResponseStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      const emergency = await tx.emergencyRequest.update({
        where: { id: response.emergencyRequestId },
        data: {
          unitsCollected: { increment: 1 },
          status: EmergencyStatus.COMPLETED,
          closedAt: new Date(),
        },
      });

      if (donationId) {
        await tx.bloodUnit.update({
          where: { id: donationId },
          data: { organizationId: response.emergencyRequest.hospitalId },
        });
      }

      return updated;
    });

    return result;
  }

  async cancelEmergency(organizationId: string, userId: string, emergencyId: string, reason?: string) {
    const { user } = await this.checkHospitalAccess(userId, organizationId);

    const emergency = await this.db.emergencyRequest.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      throw new NotFoundException('Emergency not found.');
    }

    if (emergency.hospitalId !== organizationId) {
      throw new ForbiddenException('This emergency does not belong to your organization.');
    }

    if ([EmergencyStatus.COMPLETED, EmergencyStatus.CANCELLED, EmergencyStatus.EXPIRED].includes(emergency.status)) {
      throw new BadRequestException('Emergency cannot be cancelled in current status.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: {
          status: EmergencyStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.emergencyMatch.updateMany({
        where: { emergencyRequestId: emergencyId },
        data: { status: EmergencyMatchStatus.CANCELLED },
      });

      await tx.emergencyResponse.updateMany({
        where: {
          emergencyRequestId: emergencyId,
          status: { notIn: [EmergencyResponseStatus.COMPLETED, EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED] },
        },
        data: {
          status: EmergencyResponseStatus.CANCELLED,
          cancellationReason: reason || 'Emergency cancelled by hospital',
          cancelledAt: new Date(),
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'EMERGENCY_CANCELLED',
      entityType: 'EmergencyRequest',
      entityId: emergencyId,
      organizationId,
      metadata: { emergencyReference: emergency.emergencyReference, reason },
    });

    return result;
  }

  async getEmergencyTracking(organizationId: string, userId: string, emergencyId: string) {
    await this.checkHospitalAccess(userId, organizationId);

    const emergency = await this.db.emergencyRequest.findFirst({
      where: {
        id: emergencyId,
        hospitalId: organizationId,
      },
      include: {
        responses: {
          where: {
            status: { notIn: [EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED] },
          },
          include: {
            donor: { select: { firstName: true, lastName: true } },
            locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!emergency) {
      throw new NotFoundException('Emergency not found.');
    }

    return emergency;
  }

  async getDonorTracking(donorId: string, responseId: string) {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: {
        emergencyRequest: {
          include: {
            hospital: { select: { id: true, name: true, address: true, latitude: true, longitude: true } },
          },
        },
        locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    return response;
  }

  async cancelResponse(donorId: string, responseId: string, reason?: string) {
    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: { emergencyRequest: true },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.donorId !== donorId) {
      throw new ForbiddenException('This response does not belong to you.');
    }

    if ([EmergencyResponseStatus.COMPLETED, EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED].includes(response.status)) {
      throw new BadRequestException('Response cannot be cancelled in current status.');
    }

    if (response.status === EmergencyResponseStatus.DONATION_STARTED) {
      throw new BadRequestException('Cannot cancel after donation has started.');
    }

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.emergencyResponse.update({
        where: { id: responseId },
        data: {
          status: EmergencyResponseStatus.CANCELLED,
          cancellationReason: reason || 'Cancelled by donor',
          cancelledAt: new Date(),
        },
      });

      await tx.emergencyMatch.updateMany({
        where: {
          emergencyRequestId: response.emergencyRequestId,
          donorId,
        },
        data: { status: EmergencyMatchStatus.CANCELLED },
      });

      return updated;
    });

    return result;
  }
}