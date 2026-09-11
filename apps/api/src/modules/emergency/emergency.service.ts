import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BloodType,
  ComponentType,
  DonationType,
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
import { withUniqueRetry } from '../../common/utils/unique-retry.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmergencyGateway } from '../../gateways/emergency.gateway';
import {
  DONATION_COMPLETED_EVENT,
  EMERGENCY_RESPONSE_COMPLETED_EVENT,
} from '../gamification/events/gamification-event.handler';
import { DonationEligibilityService } from '../donation-eligibility/donation-eligibility.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { assertOrganizationActive } from '../../common/utils/organization-status.util';
import { haversineDistanceKm } from '../../common/utils/geo.util';

const SOS_REQUEST_CREATED_EVENT = 'sos.request.created';
const SOS_DONOR_ACCEPTED_EVENT = 'sos.donor.accepted';
const DEFAULT_WHOLE_BLOOD_VOLUME_ML = 450;

// DonationType has no packed-red-cells value; RED_CELLS emergencies still
// record as an OTHER-type donation, matching the inventory's own BloodUnit
// (which keeps the precise ComponentType regardless of the donation record).
const COMPONENT_TO_DONATION_TYPE: Record<ComponentType, DonationType> = {
  [ComponentType.WHOLE_BLOOD]: DonationType.WHOLE_BLOOD,
  [ComponentType.PLASMA]: DonationType.PLASMA,
  [ComponentType.PLATELETS]: DonationType.PLATELETS,
  [ComponentType.RED_CELLS]: DonationType.OTHER,
  [ComponentType.OTHER]: DonationType.OTHER,
};

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
    private readonly eventEmitter: EventEmitter2,
    private readonly gateway: EmergencyGateway,
    private readonly donationEligibility: DonationEligibilityService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private generateEmergencyReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `SOS-${year}-${random}`;
  }

  private generateDonationReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `DONATION-${year}-${random}`;
  }

  private generateUnitReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `BU-${year}-${random}`;
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
    assertOrganizationActive(org);
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

    const nextEligibleDate = await this.donationEligibility.getNextEligibleDonationDate(user.id);
    if (nextEligibleDate && nextEligibleDate.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Donor is in the post-donation recovery window until ${nextEligibleDate.toISOString().split('T')[0]}.`,
      );
    }

    return user;
  }

  async createEmergency(
    organizationId: string,
    userId: string,
    dto: {
      bloodType: string;
      rhFactor: string;
      componentType?: ComponentType;
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
    if (!(await this.platformSettings.isEnabled('sosEmergencyEnabled'))) {
      throw new ForbiddenException('SOS emergency requests are currently disabled by the platform admin.');
    }

    const { user } = await this.checkHospitalAccess(userId, organizationId);

    if (dto.unitsRequired < 1 || dto.unitsRequired > 20) {
      throw new BadRequestException('Units required must be between 1 and 20.');
    }

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
          const emergency = await tx.emergencyRequest.create({
            data: {
              emergencyReference: this.generateEmergencyReference(),
              hospitalId: organizationId,
              bloodType: dto.bloodType as BloodType,
              rhFactor: dto.rhFactor as RhFactor,
              componentType: dto.componentType ?? ComponentType.WHOLE_BLOOD,
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
        }),
      { uniqueFields: ['emergencyReference'] },
    );

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

    const effectiveRequiredBefore = emergency.requiredBefore ?? new Date(Date.now() + 4 * 60 * 60 * 1000);

    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.ACTIVE, requiredBefore: effectiveRequiredBefore },
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
          // Deliberately NOT filtered to the emergency's exact blood type here.
          // Compatibility is decided below by isBloodCompatible against
          // BLOOD_COMPATIBILITY, which is what lets a compatible donor of a
          // different group (an O-negative universal donor, say) be reached at
          // all. Narrowing to an exact type at this level would make that map
          // unreachable and silently exclude exactly the donors an emergency
          // most needs.
          donorProfile: {
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
        if (!donor.donorProfile || !donor.donorProfile.bloodType || !donor.donorProfile.rhFactor) {
          return false;
        }
        if (donor.emergencyMatches.length > 0 || donor.emergencyResponses.length > 0) {
          return false;
        }
        return this.isBloodCompatible(
          donor.donorProfile.bloodType,
          donor.donorProfile.rhFactor,
          emergency.bloodType,
          emergency.rhFactor,
        );
      });

      // Rank exact blood-group matches ahead of merely compatible ones, then by
      // real distance within each tier. Donors without a usable distance sort
      // last inside their tier (still eligible - compatibility matters more
      // than an unknown distance) rather than being dropped from the pool.
      //
      // The tier matters clinically. Now that compatible donors of other groups
      // are reachable, ranking on distance alone would let a nearby O-negative
      // universal donor displace an exact-group donor for, say, an A-positive
      // patient - spending the scarcest, most broadly usable supply on a case
      // that type-specific blood already covers. Standard practice is
      // type-specific first, universal donors as the fallback, and the 50-donor
      // cap below makes that ordering decide who actually gets alerted.
      const emergencyLat = emergency.latitude !== null ? Number(emergency.latitude) : null;
      const emergencyLon = emergency.longitude !== null ? Number(emergency.longitude) : null;

      const rankedDonors = compatibleDonors
        .map((donor) => {
          const hasDonorLocation =
            donor.donorProfile!.consentLocation &&
            donor.donorProfile!.latitude !== null &&
            donor.donorProfile!.longitude !== null;
          const distanceKm =
            emergencyLat !== null && emergencyLon !== null && hasDonorLocation
              ? haversineDistanceKm(
                  emergencyLat,
                  emergencyLon,
                  Number(donor.donorProfile!.latitude),
                  Number(donor.donorProfile!.longitude),
                )
              : null;
          const isExactGroup =
            donor.donorProfile!.bloodType === emergency.bloodType &&
            donor.donorProfile!.rhFactor === emergency.rhFactor;
          return { donor, distanceKm, isExactGroup };
        })
        .sort((a, b) => {
          if (a.isExactGroup !== b.isExactGroup) return a.isExactGroup ? -1 : 1;
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });

      const matchedDonorIds: string[] = [];
      for (const { donor, distanceKm } of rankedDonors.slice(0, 50)) {
        await tx.emergencyMatch.create({
          data: {
            emergencyRequestId: emergencyId,
            donorId: donor.id,
            status: EmergencyMatchStatus.MATCHED,
            distanceKm,
            // Simple proximity score (0-100, closer is higher) - there's no
            // existing consumer of this field to match a richer formula to.
            matchScore: distanceKm !== null ? Math.max(0, Math.round(100 - distanceKm)) : null,
          },
        });
        matchedDonorIds.push(donor.id);
      }

      await tx.emergencyRequest.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.MATCHING },
      });

      return { updated, matchedDonorIds };
    });

    if (result.matchedDonorIds.length > 0) {
      this.eventEmitter.emit(SOS_REQUEST_CREATED_EVENT, {
        requestId: emergencyId,
        bloodType: `${emergency.bloodType}${emergency.rhFactor === RhFactor.POSITIVE ? '+' : '-'}`,
        urgency: emergency.urgencyLevel,
        expireAt: effectiveRequiredBefore,
        compatibleDonorIds: result.matchedDonorIds,
      });

      await this.db.emergencyMatch.updateMany({
        where: { emergencyRequestId: emergencyId, donorId: { in: result.matchedDonorIds } },
        data: { status: EmergencyMatchStatus.NOTIFIED, notifiedAt: new Date() },
      });
    }

    await this.audit.log({
      actorId: user.id,
      action: 'EMERGENCY_ACTIVATED',
      entityType: 'EmergencyRequest',
      entityId: emergencyId,
      organizationId,
      metadata: { emergencyReference: emergency.emergencyReference, matchedDonors: result.matchedDonorIds.length },
    });

    return result.updated;
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
        const validStatuses = new Set<EmergencyMatchStatus>([EmergencyMatchStatus.MATCHED, EmergencyMatchStatus.NOTIFIED, EmergencyMatchStatus.VIEWED]);
        return validStatuses.has(m.status);
      })
      .filter((m) => {
        const req = m.emergencyRequest;
        const activeStatuses = new Set<EmergencyStatus>([EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED]);
        return activeStatuses.has(req.status);
      })
      .map((m) => ({
        ...m.emergencyRequest,
        matchId: m.id,
        matchStatus: m.status,
        canAccept: this.isBloodCompatible(
          user.donorProfile!.bloodType!,
          user.donorProfile!.rhFactor!,
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

    const activeStatuses = new Set<EmergencyStatus>([EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED]);
    if (!activeStatuses.has(emergency.status)) {
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

    const hospitalStaff = await this.db.organizationMembership.findMany({
      where: {
        organizationId: emergency.hospitalId,
        status: 'ACTIVE',
        role: { code: { in: [RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF] } },
      },
      select: { userId: true },
    });

    if (hospitalStaff.length > 0) {
      this.eventEmitter.emit(SOS_DONOR_ACCEPTED_EVENT, {
        requestId: emergency.id,
        donorId,
        donorName: `${user.firstName} ${user.lastName}`,
        hospitalRecipientIds: hospitalStaff.map((m) => m.userId),
      });
    }

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

    this.gateway.emitResponseStatusChanged(response.emergencyRequestId, {
      responseId,
      donorId,
      status: EmergencyResponseStatus.EN_ROUTE,
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

    this.gateway.emitDonorLocationUpdate(response.emergencyRequestId, {
      responseId,
      donorId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      heading: dto.heading ?? null,
      speed: dto.speed ?? null,
      recordedAt: location.recordedAt.toISOString(),
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

    this.gateway.emitResponseStatusChanged(response.emergencyRequestId, {
      responseId,
      donorId,
      status: EmergencyResponseStatus.ARRIVED,
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

  /**
   * Completes an emergency donation. This must be staff-verified, never
   * donor-triggered: a donor confirming their own donation would let them
   * fabricate a donation record and self-award gamification XP. Staff record
   * the actual collected volume/blood type, which creates the same Donation +
   * BloodUnit records (and fires the same donation.completed event) as the
   * regular appointment-based donation flow, so history/XP/inventory stay
   * consistent regardless of which path a donation came through.
   */
  async completeEmergency(
    organizationId: string,
    staffUserId: string,
    responseId: string,
    dto: { bloodType?: BloodType; rhFactor?: RhFactor; componentType?: ComponentType; volumeMl?: number },
  ) {
    const { user: staff } = await this.checkHospitalAccess(staffUserId, organizationId);

    const response = await this.db.emergencyResponse.findUnique({
      where: { id: responseId },
      include: {
        emergencyRequest: true,
        donor: { include: { donorProfile: true } },
      },
    });

    if (!response) {
      throw new NotFoundException('Response not found.');
    }

    if (response.emergencyRequest.hospitalId !== organizationId) {
      throw new ForbiddenException('This response does not belong to your organization.');
    }

    if (response.status !== EmergencyResponseStatus.DONATION_STARTED) {
      throw new BadRequestException('Response must be in DONATION_STARTED to complete.');
    }

    const bloodType = dto.bloodType ?? response.donor.donorProfile?.bloodType ?? response.emergencyRequest.bloodType;
    const rhFactor = dto.rhFactor ?? response.donor.donorProfile?.rhFactor ?? response.emergencyRequest.rhFactor;
    const componentType = dto.componentType ?? response.emergencyRequest.componentType;
    const volumeMl = dto.volumeMl ?? DEFAULT_WHOLE_BLOOD_VOLUME_ML;
    // An emergency donation opens the same recovery window as a booked one.
    // Leaving it null made the donation-detail screen show no next date for
    // exactly the donations a donor is proudest of.
    const collectionCompletedAt = new Date();
    const nextDonationDate = this.donationEligibility.computeDefaultNextEligibleDate(collectionCompletedAt);

    const result = await withUniqueRetry(
      () =>
        this.db.$transaction(async (tx) => {
          const donation = await tx.donation.create({
            data: {
              donationReference: this.generateDonationReference(),
              donorId: response.donorId,
              organizationId,
              donationType: COMPONENT_TO_DONATION_TYPE[componentType],
              status: 'COMPLETED',
              bloodType,
              rhFactor,
              volumeMl,
              collectionStartedAt: response.donationStartedAt ?? collectionCompletedAt,
              collectionCompletedAt,
              completedAt: collectionCompletedAt,
              completedBy: staff.id,
              nextDonationDate,
            },
          });

          await tx.donationEvent.create({
            data: {
              donationId: donation.id,
              eventType: 'COMPLETED',
              actorId: staff.id,
              organizationId,
              metadata: { source: 'EMERGENCY', emergencyResponseId: responseId, bloodType, rhFactor, componentType, volumeMl },
            },
          });

          await tx.bloodUnit.create({
            data: {
              unitReference: this.generateUnitReference(),
              donationId: donation.id,
              organizationId,
              componentType,
              bloodType,
              rhFactor,
              volumeMl,
              status: 'COLLECTED',
              collectedAt: new Date(),
            },
          });

          const updatedResponse = await tx.emergencyResponse.update({
            where: { id: responseId },
            data: {
              status: EmergencyResponseStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          const emergency = await tx.emergencyRequest.update({
            where: { id: response.emergencyRequestId },
            data: { unitsCollected: { increment: 1 } },
          });

          if (emergency.unitsCollected >= emergency.unitsRequired) {
            await tx.emergencyRequest.update({
              where: { id: response.emergencyRequestId },
              data: { status: EmergencyStatus.COMPLETED, closedAt: new Date() },
            });
          }

          return { response: updatedResponse, donation };
        }),
      { uniqueFields: ['donationReference', 'unitReference'] },
    );

    this.eventEmitter.emit(DONATION_COMPLETED_EVENT, {
      donationId: result.donation.id,
      donorId: response.donorId,
      organizationId,
      isEmergency: true,
    });

    // Separate from DONATION_COMPLETED_EVENT above: this awards the
    // emergency-specific rewards (EMERGENCY_RESPONSE_COUNT achievement,
    // emergency reputation bonus) that the generic donation-completed path
    // doesn't grant, since responding to an SOS is a distinct accomplishment
    // from the donation itself.
    this.eventEmitter.emit(EMERGENCY_RESPONSE_COMPLETED_EVENT, {
      responseId,
      donorId: response.donorId,
    });

    this.gateway.emitResponseStatusChanged(response.emergencyRequestId, {
      responseId,
      donorId: response.donorId,
      status: EmergencyResponseStatus.COMPLETED,
    });

    await this.audit.log({
      actorId: staff.id,
      action: 'EMERGENCY_DONATION_COMPLETED',
      entityType: 'EmergencyResponse',
      entityId: responseId,
      organizationId,
      metadata: {
        emergencyReference: response.emergencyRequest.emergencyReference,
        donationId: result.donation.id,
        bloodType,
        rhFactor,
        volumeMl,
      },
    });

    return result.response;
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

    const nonCancellableStatuses = new Set<EmergencyStatus>([EmergencyStatus.COMPLETED, EmergencyStatus.CANCELLED, EmergencyStatus.EXPIRED]);
    if (nonCancellableStatuses.has(emergency.status)) {
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

    const terminalStatuses = new Set<EmergencyResponseStatus>([EmergencyResponseStatus.COMPLETED, EmergencyResponseStatus.CANCELLED, EmergencyResponseStatus.FAILED]);
    if (terminalStatuses.has(response.status)) {
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