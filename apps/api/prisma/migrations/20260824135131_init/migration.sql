-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'BLOOD_CENTER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('DONOR', 'HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF', 'COURIER', 'SUPER_ADMIN', 'LAB_TECHNICIAN', 'LAB_REVIEWER', 'LAB_ADMIN');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A', 'B', 'AB', 'O');

-- CreateEnum
CREATE TYPE "RhFactor" AS ENUM ('POSITIVE', 'NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEFERRED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('BLOOD_CENTER', 'HOSPITAL', 'LABORATORY', 'OTHER_AUTHORIZED_SOURCE');

-- CreateEnum
CREATE TYPE "TestCategory" AS ENUM ('HEMATOLOGY', 'IRON', 'BLOOD_GROUP', 'LIVER_FUNCTION', 'KIDNEY_FUNCTION', 'DIABETES', 'THYROID', 'LIPID', 'GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ResultFlag" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL', 'ABNORMAL', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('BLOOD_DONATION', 'BLOOD_TEST', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'RESULT_PENDING', 'RESULT_READY', 'RESULT_PUBLISHED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'FULL', 'BLOCKED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('WHOLE_BLOOD', 'PLASMA', 'PLATELETS', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABORTED', 'NO_SHOW', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssessmentDecision" AS ENUM ('APPROVED_FOR_DONATION', 'DEFERRED', 'NOT_COMPLETED');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('DONOR_CANCELLED', 'ORGANIZATION_CANCELLED', 'NOT_COMPLETED', 'DEFERRED', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodUnitStatus" AS ENUM ('COLLECTED', 'AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'DISCARDED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIVED', 'MOVED', 'RESERVED', 'RELEASED', 'USED', 'EXPIRED', 'DISCARDED', 'QUARANTINED', 'RELEASED_FROM_QUARANTINE', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'PARTIALLY_DELIVERED');

-- CreateEnum
CREATE TYPE "BloodRequestPriority" AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'COURIER_DECLINED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_HOSPITAL', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourierStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShipmentEventType" AS ENUM ('CREATED', 'COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'COURIER_DECLINED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'LOCATION_UPDATED', 'ARRIVED_AT_HOSPITAL', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('VEHICLE_ISSUE', 'ROAD_ISSUE', 'COURIER_ISSUE', 'HOSPITAL_UNAVAILABLE', 'PACKAGE_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MATCHING', 'RESPONSES_RECEIVED', 'DONOR_CONFIRMED', 'DONOR_EN_ROUTE', 'DONOR_ARRIVED', 'DONATION_STARTED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmergencyMatchStatus" AS ENUM ('MATCHED', 'NOTIFIED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "EmergencyResponseStatus" AS ENUM ('ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'DONATION_STARTED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('STORAGE', 'QUARANTINE', 'PROCESSING', 'DISTRIBUTION');

-- CreateEnum
CREATE TYPE "DonationEventType" AS ENUM ('CREATED', 'CHECKED_IN', 'ASSESSMENT_RECORDED', 'STARTED', 'COMPLETED', 'CANCELLED', 'ABORTED', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('DONATION_COUNT', 'EMERGENCY_RESPONSE_COUNT', 'BLOOD_TEST_COUNT', 'APPOINTMENT_COMPLETION_COUNT', 'XP_MILESTONE', 'STREAK', 'CUSTOM_EVENT', 'CHALLENGE_COMPLETED', 'CAMPAIGN_PARTICIPATED', 'EDUCATION_COMPLETED');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AchievementStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "XpTransactionType" AS ENUM ('DONATION_COMPLETED', 'EMERGENCY_DONATION_COMPLETED', 'BLOOD_TEST_COMPLETED', 'APPOINTMENT_COMPLETED', 'PROFILE_COMPLETED', 'ACHIEVEMENT_UNLOCKED', 'ADMIN_ADJUSTMENT', 'EMERGENCY_RESPONSE_ACCEPTED', 'STREAK_BONUS', 'CHALLENGE_COMPLETED', 'CAMPAIGN_PARTICIPATED', 'EDUCATION_COMPLETED');

-- CreateEnum
CREATE TYPE "ReputationType" AS ENUM ('VERIFIED_CONTRIBUTION', 'EMERGENCY_RESPONSE', 'APPOINTMENT_ATTENDANCE', 'COMMUNITY_ACTION', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('CAMPAIGN', 'EDUCATION', 'MILESTONE', 'ACHIEVEMENT', 'COMMUNITY_UPDATE', 'ANNOUNCEMENT', 'IMPACT');

-- CreateEnum
CREATE TYPE "CommunityPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('DONATION_MILESTONE', 'CAMPAIGN_PARTICIPATION', 'EDUCATION', 'COMMUNITY', 'APPOINTMENT_COMPLETION', 'CONSISTENCY');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChallengeVisibility" AS ENUM ('PUBLIC', 'ORGANIZATION', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'MISINFORMATION', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EducationContentType" AS ENUM ('ARTICLE', 'QUIZ', 'VIDEO');

-- CreateEnum
CREATE TYPE "EducationProgressStatus" AS ENUM ('STARTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMERGENCY', 'DONATION', 'APPOINTMENT', 'LABORATORY', 'AI', 'GAMIFICATION', 'BLOOD_REQUEST', 'SHIPMENT', 'INVENTORY', 'SECURITY', 'SYSTEM', 'COMMUNITY', 'CAMPAIGN', 'CHALLENGE', 'EDUCATION');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'ARCHIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'INVALID_TOKEN');

-- CreateEnum
CREATE TYPE "AIInsightType" AS ENUM ('TREND_SUMMARY', 'RESULT_EXPLANATION', 'DATA_CHANGE', 'DONATION_INSIGHT', 'APPOINTMENT_INSIGHT', 'HEALTH_SUMMARY', 'WEEKLY_SUMMARY', 'QUESTION_SUGGESTION', 'GENERAL_HEALTH_INFORMATION');

-- CreateEnum
CREATE TYPE "AIInsightStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AISafetyLevel" AS ENUM ('SAFE_INFORMATIONAL', 'NEEDS_CONTEXT', 'PROFESSIONAL_REVIEW_SUGGESTED', 'EMERGENCY_REDIRECT', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "AIFeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'REPORT_ISSUE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(20),
    "passwordHash" TEXT NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(120),
    "avatarUrl" VARCHAR(500),
    "dateOfBirth" DATE,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodCenter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "BloodCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bloodType" "BloodType",
    "rhFactor" "RhFactor",
    "bloodTypeVerifiedAt" TIMESTAMP(3),
    "bloodTypeVerifiedBy" TEXT,
    "bloodTypeSource" "VerificationSource",
    "bloodTypeNote" TEXT,
    "city" VARCHAR(100),
    "district" VARCHAR(100),
    "donorStatus" "DonorStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "dateOfBirth" DATE,
    "consentLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emergencyRequests" BOOLEAN NOT NULL DEFAULT true,
    "appointments" BOOLEAN NOT NULL DEFAULT true,
    "donationReminders" BOOLEAN NOT NULL DEFAULT true,
    "healthResults" BOOLEAN NOT NULL DEFAULT false,
    "gamification" BOOLEAN NOT NULL DEFAULT true,
    "bloodRequests" BOOLEAN NOT NULL DEFAULT true,
    "shipments" BOOLEAN NOT NULL DEFAULT true,
    "inventory" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT true,
    "security" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "quietHoursTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appointmentType" "AppointmentType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "appointmentType" "AppointmentType" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" "AppointmentStatus",
    "newStatus" "AppointmentStatus",
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donationReference" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "donationType" "DonationType" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "status" "DonationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bloodType" "BloodType",
    "rhFactor" "RhFactor",
    "volumeMl" INTEGER,
    "collectionStartedAt" TIMESTAMP(3),
    "collectionCompletedAt" TIMESTAMP(3),
    "staffNotes" TEXT,
    "nextDonationDate" TIMESTAMP(3),
    "cancellationReason" "CancellationReason",
    "cancelledAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "abortedReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationEvent" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "eventType" "DonationEventType" NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationAssessment" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "decision" "AssessmentDecision" NOT NULL,
    "reasonCategory" TEXT,
    "notes" TEXT,
    "assessedBy" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnit" (
    "id" TEXT NOT NULL,
    "unitReference" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "componentType" "ComponentType" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "status" "BloodUnitStatus" NOT NULL DEFAULT 'COLLECTED',
    "locationId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'STORAGE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "type" "MovementType" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnitReservation" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservedForOrganizationId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reservedBy" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodUnitReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "bloodType" "BloodType",
    "rhFactor" "RhFactor",
    "message" TEXT NOT NULL,
    "threshold" INTEGER,
    "currentValue" INTEGER,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodRequest" (
    "id" TEXT NOT NULL,
    "requestReference" TEXT NOT NULL,
    "requestingOrganizationId" TEXT NOT NULL,
    "fulfillingOrganizationId" TEXT,
    "priority" "BloodRequestPriority" NOT NULL DEFAULT 'ROUTINE',
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "deliveryAddress" TEXT,
    "deliveryLatitude" DECIMAL(9,6),
    "deliveryLongitude" DECIMAL(9,6),
    "deliveryPhone" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodRequestItem" (
    "id" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "componentType" "ComponentType" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "unitsRequested" INTEGER NOT NULL,
    "unitsApproved" INTEGER NOT NULL DEFAULT 0,
    "unitsFulfilled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodRequestEvent" (
    "id" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "status" "CourierStatus" NOT NULL DEFAULT 'OFFLINE',
    "currentShipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentReference" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "sourceOrganizationId" TEXT NOT NULL,
    "destinationOrganizationId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "pickupAddress" TEXT,
    "pickupLatitude" DECIMAL(9,6),
    "pickupLongitude" DECIMAL(9,6),
    "destinationAddress" TEXT,
    "destinationLatitude" DECIMAL(9,6),
    "destinationLongitude" DECIMAL(9,6),
    "assignedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "pickupStartedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" "DeliveryFailureReason",
    "failureNotes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "estimatedArrivalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentUnit" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bloodRequestItemId" TEXT,

    CONSTRAINT "ShipmentUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "eventType" "ShipmentEventType" NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLocation" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(8,2),
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" TEXT NOT NULL,
    "emergencyReference" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "urgencyLevel" TEXT NOT NULL DEFAULT 'CRITICAL',
    "status" "EmergencyStatus" NOT NULL DEFAULT 'DRAFT',
    "patientReference" TEXT,
    "description" TEXT,
    "requiredBefore" TIMESTAMP(3),
    "donationLocation" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "unitsCommitted" INTEGER NOT NULL DEFAULT 0,
    "unitsArrived" INTEGER NOT NULL DEFAULT 0,
    "unitsCollected" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyMatch" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "status" "EmergencyMatchStatus" NOT NULL DEFAULT 'MATCHED',
    "notifiedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyResponse" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "matchId" TEXT,
    "donorId" TEXT NOT NULL,
    "status" "EmergencyResponseStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "donationStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyLocation" (
    "id" TEXT NOT NULL,
    "emergencyResponseId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(8,2),
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TestCategory" NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestParameter" (
    "id" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'numeric',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestReferenceRange" (
    "id" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "laboratoryId" TEXT,
    "minValue" DECIMAL(10,3),
    "maxValue" DECIMAL(10,3),
    "unit" TEXT,
    "notes" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaboratoryProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "workingHours" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboratoryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaboratoryResult" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "performedAt" TIMESTAMP(3),
    "performedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboratoryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaboratoryResultItem" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "value" TEXT,
    "numericValue" DECIMAL(15,4),
    "unit" TEXT,
    "referenceMin" DECIMAL(10,3),
    "referenceMax" DECIMAL(10,3),
    "flag" "ResultFlag" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboratoryResultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaboratoryResultVersion" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaboratoryResultVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "leaderboardVisibility" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "XpTransactionType" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'COMMON',
    "criteria" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'COMMON',
    "achievementId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "ReputationType" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "type" "CommunityPostType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "authorId" TEXT,
    "organizationId" TEXT,
    "campaignId" TEXT,
    "achievementId" TEXT,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "bloodGroupsNeeded" "BloodType"[],
    "targetParticipants" INTEGER,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ChallengeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "organizationId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "goal" INTEGER NOT NULL DEFAULT 1,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "badgeId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalContent" (
    "id" TEXT NOT NULL,
    "type" "EducationContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER',
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationalContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" "EducationProgressStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EducationProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ContentReportReason" NOT NULL,
    "description" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "deepLink" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AIInsightType" NOT NULL,
    "status" "AIInsightStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "summary" TEXT,
    "observations" JSONB,
    "dataPoints" JSONB,
    "caveats" JSONB,
    "questionsForProfessional" JSONB,
    "safetyLevel" "AISafetyLevel" NOT NULL DEFAULT 'SAFE_INFORMATIONAL',
    "dataVersion" TEXT,
    "dataReferences" JSONB,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT NOT NULL,
    "insightType" "AIInsightType",
    "providerName" TEXT NOT NULL,
    "modelUsed" TEXT,
    "promptVersion" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "safetyLevel" "AISafetyLevel",
    "dataVersion" TEXT,
    "requestFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsightCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightType" "AIInsightType" NOT NULL,
    "dataVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "model" TEXT,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "safetyLevel" "AISafetyLevel",
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "type" "AIFeedbackType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BloodRequestItemToBloodUnitReservation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BloodRequestItemToBloodUnitReservation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LaboratoryProfileToTestType" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LaboratoryProfileToTestType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_organizationId_key" ON "Hospital"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodCenter_organizationId_key" ON "BloodCenter"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_roleId_idx" ON "OrganizationMembership"("roleId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_status_idx" ON "OrganizationMembership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_roleId_key" ON "OrganizationMembership"("userId", "organizationId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "DonorProfile_userId_key" ON "DonorProfile"("userId");

-- CreateIndex
CREATE INDEX "DonorProfile_userId_idx" ON "DonorProfile"("userId");

-- CreateIndex
CREATE INDEX "DonorProfile_bloodType_idx" ON "DonorProfile"("bloodType");

-- CreateIndex
CREATE INDEX "DonorProfile_donorStatus_idx" ON "DonorProfile"("donorStatus");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_userId_key" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "AppointmentSlot_organizationId_idx" ON "AppointmentSlot"("organizationId");

-- CreateIndex
CREATE INDEX "AppointmentSlot_appointmentType_idx" ON "AppointmentSlot"("appointmentType");

-- CreateIndex
CREATE INDEX "AppointmentSlot_startAt_idx" ON "AppointmentSlot"("startAt");

-- CreateIndex
CREATE INDEX "AppointmentSlot_endAt_idx" ON "AppointmentSlot"("endAt");

-- CreateIndex
CREATE INDEX "AppointmentSlot_status_idx" ON "AppointmentSlot"("status");

-- CreateIndex
CREATE INDEX "AppointmentSlot_organizationId_appointmentType_startAt_idx" ON "AppointmentSlot"("organizationId", "appointmentType", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_referenceNumber_key" ON "Appointment"("referenceNumber");

-- CreateIndex
CREATE INDEX "Appointment_donorId_idx" ON "Appointment"("donorId");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_idx" ON "Appointment"("organizationId");

-- CreateIndex
CREATE INDEX "Appointment_slotId_idx" ON "Appointment"("slotId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_scheduledStart_idx" ON "Appointment"("scheduledStart");

-- CreateIndex
CREATE INDEX "Appointment_scheduledEnd_idx" ON "Appointment"("scheduledEnd");

-- CreateIndex
CREATE INDEX "Appointment_referenceNumber_idx" ON "Appointment"("referenceNumber");

-- CreateIndex
CREATE INDEX "Appointment_donorId_status_idx" ON "Appointment"("donorId", "status");

-- CreateIndex
CREATE INDEX "AppointmentHistory_appointmentId_idx" ON "AppointmentHistory"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentHistory_actorId_idx" ON "AppointmentHistory"("actorId");

-- CreateIndex
CREATE INDEX "AppointmentHistory_createdAt_idx" ON "AppointmentHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_donationReference_key" ON "Donation"("donationReference");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_appointmentId_key" ON "Donation"("appointmentId");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_organizationId_idx" ON "Donation"("organizationId");

-- CreateIndex
CREATE INDEX "Donation_appointmentId_idx" ON "Donation"("appointmentId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_createdAt_idx" ON "Donation"("createdAt");

-- CreateIndex
CREATE INDEX "Donation_donationReference_idx" ON "Donation"("donationReference");

-- CreateIndex
CREATE INDEX "Donation_collectionCompletedAt_idx" ON "Donation"("collectionCompletedAt");

-- CreateIndex
CREATE INDEX "Donation_bloodType_idx" ON "Donation"("bloodType");

-- CreateIndex
CREATE INDEX "DonationEvent_donationId_idx" ON "DonationEvent"("donationId");

-- CreateIndex
CREATE INDEX "DonationEvent_actorId_idx" ON "DonationEvent"("actorId");

-- CreateIndex
CREATE INDEX "DonationEvent_eventType_idx" ON "DonationEvent"("eventType");

-- CreateIndex
CREATE INDEX "DonationEvent_createdAt_idx" ON "DonationEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonationAssessment_donationId_key" ON "DonationAssessment"("donationId");

-- CreateIndex
CREATE INDEX "DonationAssessment_donationId_idx" ON "DonationAssessment"("donationId");

-- CreateIndex
CREATE INDEX "DonationAssessment_assessedBy_idx" ON "DonationAssessment"("assessedBy");

-- CreateIndex
CREATE UNIQUE INDEX "BloodUnit_unitReference_key" ON "BloodUnit"("unitReference");

-- CreateIndex
CREATE UNIQUE INDEX "BloodUnit_donationId_key" ON "BloodUnit"("donationId");

-- CreateIndex
CREATE INDEX "BloodUnit_donationId_idx" ON "BloodUnit"("donationId");

-- CreateIndex
CREATE INDEX "BloodUnit_organizationId_idx" ON "BloodUnit"("organizationId");

-- CreateIndex
CREATE INDEX "BloodUnit_bloodType_idx" ON "BloodUnit"("bloodType");

-- CreateIndex
CREATE INDEX "BloodUnit_status_idx" ON "BloodUnit"("status");

-- CreateIndex
CREATE INDEX "BloodUnit_collectedAt_idx" ON "BloodUnit"("collectedAt");

-- CreateIndex
CREATE INDEX "BloodUnit_locationId_idx" ON "BloodUnit"("locationId");

-- CreateIndex
CREATE INDEX "BloodUnit_unitReference_idx" ON "BloodUnit"("unitReference");

-- CreateIndex
CREATE INDEX "InventoryLocation_organizationId_idx" ON "InventoryLocation"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryLocation_active_idx" ON "InventoryLocation"("active");

-- CreateIndex
CREATE INDEX "InventoryMovement_bloodUnitId_idx" ON "InventoryMovement"("bloodUnitId");

-- CreateIndex
CREATE INDEX "InventoryMovement_organizationId_idx" ON "InventoryMovement"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "BloodUnitReservation_bloodUnitId_idx" ON "BloodUnitReservation"("bloodUnitId");

-- CreateIndex
CREATE INDEX "BloodUnitReservation_organizationId_idx" ON "BloodUnitReservation"("organizationId");

-- CreateIndex
CREATE INDEX "BloodUnitReservation_status_idx" ON "BloodUnitReservation"("status");

-- CreateIndex
CREATE INDEX "BloodUnitReservation_reservedAt_idx" ON "BloodUnitReservation"("reservedAt");

-- CreateIndex
CREATE INDEX "InventoryAlert_organizationId_idx" ON "InventoryAlert"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryAlert_type_idx" ON "InventoryAlert"("type");

-- CreateIndex
CREATE INDEX "InventoryAlert_acknowledged_idx" ON "InventoryAlert"("acknowledged");

-- CreateIndex
CREATE UNIQUE INDEX "BloodRequest_requestReference_key" ON "BloodRequest"("requestReference");

-- CreateIndex
CREATE INDEX "BloodRequest_requestingOrganizationId_idx" ON "BloodRequest"("requestingOrganizationId");

-- CreateIndex
CREATE INDEX "BloodRequest_fulfillingOrganizationId_idx" ON "BloodRequest"("fulfillingOrganizationId");

-- CreateIndex
CREATE INDEX "BloodRequest_status_idx" ON "BloodRequest"("status");

-- CreateIndex
CREATE INDEX "BloodRequest_priority_idx" ON "BloodRequest"("priority");

-- CreateIndex
CREATE INDEX "BloodRequest_createdAt_idx" ON "BloodRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BloodRequestItem_bloodRequestId_idx" ON "BloodRequestItem"("bloodRequestId");

-- CreateIndex
CREATE INDEX "BloodRequestItem_bloodType_idx" ON "BloodRequestItem"("bloodType");

-- CreateIndex
CREATE INDEX "BloodRequestItem_rhFactor_idx" ON "BloodRequestItem"("rhFactor");

-- CreateIndex
CREATE INDEX "BloodRequestEvent_bloodRequestId_idx" ON "BloodRequestEvent"("bloodRequestId");

-- CreateIndex
CREATE INDEX "BloodRequestEvent_actorId_idx" ON "BloodRequestEvent"("actorId");

-- CreateIndex
CREATE INDEX "BloodRequestEvent_createdAt_idx" ON "BloodRequestEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier"("userId");

-- CreateIndex
CREATE INDEX "Courier_userId_idx" ON "Courier"("userId");

-- CreateIndex
CREATE INDEX "Courier_organizationId_idx" ON "Courier"("organizationId");

-- CreateIndex
CREATE INDEX "Courier_status_idx" ON "Courier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentReference_key" ON "Shipment"("shipmentReference");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_bloodRequestId_key" ON "Shipment"("bloodRequestId");

-- CreateIndex
CREATE INDEX "Shipment_bloodRequestId_idx" ON "Shipment"("bloodRequestId");

-- CreateIndex
CREATE INDEX "Shipment_sourceOrganizationId_idx" ON "Shipment"("sourceOrganizationId");

-- CreateIndex
CREATE INDEX "Shipment_destinationOrganizationId_idx" ON "Shipment"("destinationOrganizationId");

-- CreateIndex
CREATE INDEX "Shipment_courierId_idx" ON "Shipment"("courierId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_shipmentReference_idx" ON "Shipment"("shipmentReference");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentUnit_shipmentId_idx" ON "ShipmentUnit"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentUnit_bloodUnitId_idx" ON "ShipmentUnit"("bloodUnitId");

-- CreateIndex
CREATE INDEX "ShipmentUnit_reservationId_idx" ON "ShipmentUnit"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentUnit_shipmentId_bloodUnitId_key" ON "ShipmentUnit"("shipmentId", "bloodUnitId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_actorId_idx" ON "ShipmentEvent"("actorId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_createdAt_idx" ON "ShipmentEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentLocation_shipmentId_idx" ON "ShipmentLocation"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLocation_courierId_idx" ON "ShipmentLocation"("courierId");

-- CreateIndex
CREATE INDEX "ShipmentLocation_recordedAt_idx" ON "ShipmentLocation"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyRequest_emergencyReference_key" ON "EmergencyRequest"("emergencyReference");

-- CreateIndex
CREATE INDEX "EmergencyRequest_hospitalId_idx" ON "EmergencyRequest"("hospitalId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_bloodType_idx" ON "EmergencyRequest"("bloodType");

-- CreateIndex
CREATE INDEX "EmergencyRequest_rhFactor_idx" ON "EmergencyRequest"("rhFactor");

-- CreateIndex
CREATE INDEX "EmergencyRequest_status_idx" ON "EmergencyRequest"("status");

-- CreateIndex
CREATE INDEX "EmergencyRequest_urgencyLevel_idx" ON "EmergencyRequest"("urgencyLevel");

-- CreateIndex
CREATE INDEX "EmergencyRequest_createdAt_idx" ON "EmergencyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "EmergencyMatch_emergencyRequestId_idx" ON "EmergencyMatch"("emergencyRequestId");

-- CreateIndex
CREATE INDEX "EmergencyMatch_donorId_idx" ON "EmergencyMatch"("donorId");

-- CreateIndex
CREATE INDEX "EmergencyMatch_status_idx" ON "EmergencyMatch"("status");

-- CreateIndex
CREATE INDEX "EmergencyMatch_createdAt_idx" ON "EmergencyMatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyMatch_emergencyRequestId_donorId_key" ON "EmergencyMatch"("emergencyRequestId", "donorId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyResponse_matchId_key" ON "EmergencyResponse"("matchId");

-- CreateIndex
CREATE INDEX "EmergencyResponse_emergencyRequestId_idx" ON "EmergencyResponse"("emergencyRequestId");

-- CreateIndex
CREATE INDEX "EmergencyResponse_donorId_idx" ON "EmergencyResponse"("donorId");

-- CreateIndex
CREATE INDEX "EmergencyResponse_status_idx" ON "EmergencyResponse"("status");

-- CreateIndex
CREATE INDEX "EmergencyResponse_createdAt_idx" ON "EmergencyResponse"("createdAt");

-- CreateIndex
CREATE INDEX "EmergencyLocation_emergencyResponseId_idx" ON "EmergencyLocation"("emergencyResponseId");

-- CreateIndex
CREATE INDEX "EmergencyLocation_recordedAt_idx" ON "EmergencyLocation"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestType_code_key" ON "TestType"("code");

-- CreateIndex
CREATE INDEX "TestType_category_idx" ON "TestType"("category");

-- CreateIndex
CREATE INDEX "TestType_isActive_idx" ON "TestType"("isActive");

-- CreateIndex
CREATE INDEX "TestParameter_testTypeId_idx" ON "TestParameter"("testTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TestParameter_testTypeId_code_key" ON "TestParameter"("testTypeId", "code");

-- CreateIndex
CREATE INDEX "TestReferenceRange_testTypeId_idx" ON "TestReferenceRange"("testTypeId");

-- CreateIndex
CREATE INDEX "TestReferenceRange_laboratoryId_idx" ON "TestReferenceRange"("laboratoryId");

-- CreateIndex
CREATE INDEX "TestReferenceRange_isActive_idx" ON "TestReferenceRange"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LaboratoryProfile_organizationId_key" ON "LaboratoryProfile"("organizationId");

-- CreateIndex
CREATE INDEX "LaboratoryProfile_organizationId_idx" ON "LaboratoryProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LaboratoryResult_appointmentId_key" ON "LaboratoryResult"("appointmentId");

-- CreateIndex
CREATE INDEX "LaboratoryResult_donorId_idx" ON "LaboratoryResult"("donorId");

-- CreateIndex
CREATE INDEX "LaboratoryResult_laboratoryId_idx" ON "LaboratoryResult"("laboratoryId");

-- CreateIndex
CREATE INDEX "LaboratoryResult_testTypeId_idx" ON "LaboratoryResult"("testTypeId");

-- CreateIndex
CREATE INDEX "LaboratoryResult_status_idx" ON "LaboratoryResult"("status");

-- CreateIndex
CREATE INDEX "LaboratoryResult_appointmentId_idx" ON "LaboratoryResult"("appointmentId");

-- CreateIndex
CREATE INDEX "LaboratoryResult_publishedAt_idx" ON "LaboratoryResult"("publishedAt");

-- CreateIndex
CREATE INDEX "LaboratoryResultItem_resultId_idx" ON "LaboratoryResultItem"("resultId");

-- CreateIndex
CREATE INDEX "LaboratoryResultItem_parameterId_idx" ON "LaboratoryResultItem"("parameterId");

-- CreateIndex
CREATE INDEX "LaboratoryResultVersion_resultId_idx" ON "LaboratoryResultVersion"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "LaboratoryResultVersion_resultId_version_key" ON "LaboratoryResultVersion"("resultId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationProfile_userId_key" ON "GamificationProfile"("userId");

-- CreateIndex
CREATE INDEX "GamificationProfile_userId_idx" ON "GamificationProfile"("userId");

-- CreateIndex
CREATE INDEX "GamificationProfile_totalXp_idx" ON "GamificationProfile"("totalXp");

-- CreateIndex
CREATE INDEX "GamificationProfile_level_idx" ON "GamificationProfile"("level");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_idx" ON "XpTransaction"("userId");

-- CreateIndex
CREATE INDEX "XpTransaction_type_idx" ON "XpTransaction"("type");

-- CreateIndex
CREATE INDEX "XpTransaction_createdAt_idx" ON "XpTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpTransaction_sourceType_sourceId_key" ON "XpTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "Achievement_type_idx" ON "Achievement"("type");

-- CreateIndex
CREATE INDEX "Achievement_isActive_idx" ON "Achievement"("isActive");

-- CreateIndex
CREATE INDEX "Achievement_displayOrder_idx" ON "Achievement"("displayOrder");

-- CreateIndex
CREATE INDEX "AchievementUnlock_userId_idx" ON "AchievementUnlock"("userId");

-- CreateIndex
CREATE INDEX "AchievementUnlock_achievementId_idx" ON "AchievementUnlock"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementId_key" ON "AchievementUnlock"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE INDEX "Badge_isActive_idx" ON "Badge"("isActive");

-- CreateIndex
CREATE INDEX "Badge_displayOrder_idx" ON "Badge"("displayOrder");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "ReputationTransaction_userId_idx" ON "ReputationTransaction"("userId");

-- CreateIndex
CREATE INDEX "ReputationTransaction_type_idx" ON "ReputationTransaction"("type");

-- CreateIndex
CREATE INDEX "ReputationTransaction_createdAt_idx" ON "ReputationTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_type_idx" ON "CommunityPost"("type");

-- CreateIndex
CREATE INDEX "CommunityPost_status_idx" ON "CommunityPost"("status");

-- CreateIndex
CREATE INDEX "CommunityPost_publishedAt_idx" ON "CommunityPost"("publishedAt");

-- CreateIndex
CREATE INDEX "CommunityPost_organizationId_idx" ON "CommunityPost"("organizationId");

-- CreateIndex
CREATE INDEX "CommunityPost_campaignId_idx" ON "CommunityPost"("campaignId");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_startDate_idx" ON "Campaign"("startDate");

-- CreateIndex
CREATE INDEX "Campaign_endDate_idx" ON "Campaign"("endDate");

-- CreateIndex
CREATE INDEX "CampaignParticipant_campaignId_idx" ON "CampaignParticipant"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignParticipant_userId_idx" ON "CampaignParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignParticipant_campaignId_userId_key" ON "CampaignParticipant"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "Challenge_type_idx" ON "Challenge"("type");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "Challenge_visibility_idx" ON "Challenge"("visibility");

-- CreateIndex
CREATE INDEX "Challenge_organizationId_idx" ON "Challenge"("organizationId");

-- CreateIndex
CREATE INDEX "Challenge_startDate_idx" ON "Challenge"("startDate");

-- CreateIndex
CREATE INDEX "Challenge_endDate_idx" ON "Challenge"("endDate");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_challengeId_idx" ON "ChallengeParticipant"("challengeId");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_userId_idx" ON "ChallengeParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_completedAt_idx" ON "ChallengeParticipant"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_userId_key" ON "ChallengeParticipant"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "EducationalContent_type_idx" ON "EducationalContent"("type");

-- CreateIndex
CREATE INDEX "EducationalContent_category_idx" ON "EducationalContent"("category");

-- CreateIndex
CREATE INDEX "EducationalContent_isActive_idx" ON "EducationalContent"("isActive");

-- CreateIndex
CREATE INDEX "EducationalContent_displayOrder_idx" ON "EducationalContent"("displayOrder");

-- CreateIndex
CREATE INDEX "EducationProgress_userId_idx" ON "EducationProgress"("userId");

-- CreateIndex
CREATE INDEX "EducationProgress_contentId_idx" ON "EducationProgress"("contentId");

-- CreateIndex
CREATE INDEX "EducationProgress_status_idx" ON "EducationProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EducationProgress_userId_contentId_key" ON "EducationProgress"("userId", "contentId");

-- CreateIndex
CREATE INDEX "ContentReport_postId_idx" ON "ContentReport"("postId");

-- CreateIndex
CREATE INDEX "ContentReport_reporterId_idx" ON "ContentReport"("reporterId");

-- CreateIndex
CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");

-- CreateIndex
CREATE INDEX "ContentReport_createdAt_idx" ON "ContentReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "PushDevice_isActive_idx" ON "PushDevice"("isActive");

-- CreateIndex
CREATE INDEX "PushDevice_lastSeenAt_idx" ON "PushDevice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_idempotencyKey_idx" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_idempotencyKey_key" ON "Notification"("recipientId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "AIInsight_userId_idx" ON "AIInsight"("userId");

-- CreateIndex
CREATE INDEX "AIInsight_type_idx" ON "AIInsight"("type");

-- CreateIndex
CREATE INDEX "AIInsight_status_idx" ON "AIInsight"("status");

-- CreateIndex
CREATE INDEX "AIInsight_createdAt_idx" ON "AIInsight"("createdAt");

-- CreateIndex
CREATE INDEX "AIInsight_sourceType_sourceId_idx" ON "AIInsight"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AIInsight_promptVersion_idx" ON "AIInsight"("promptVersion");

-- CreateIndex
CREATE INDEX "AIInsight_model_idx" ON "AIInsight"("model");

-- CreateIndex
CREATE UNIQUE INDEX "AIRequestLog_requestId_key" ON "AIRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "AIRequestLog_userId_idx" ON "AIRequestLog"("userId");

-- CreateIndex
CREATE INDEX "AIRequestLog_insightType_idx" ON "AIRequestLog"("insightType");

-- CreateIndex
CREATE INDEX "AIRequestLog_createdAt_idx" ON "AIRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIRequestLog_success_idx" ON "AIRequestLog"("success");

-- CreateIndex
CREATE INDEX "AIRequestLog_requestFingerprint_idx" ON "AIRequestLog"("requestFingerprint");

-- CreateIndex
CREATE INDEX "AIRequestLog_promptVersion_idx" ON "AIRequestLog"("promptVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AIInsightCache_cacheKey_key" ON "AIInsightCache"("cacheKey");

-- CreateIndex
CREATE INDEX "AIInsightCache_userId_idx" ON "AIInsightCache"("userId");

-- CreateIndex
CREATE INDEX "AIInsightCache_cacheKey_idx" ON "AIInsightCache"("cacheKey");

-- CreateIndex
CREATE INDEX "AIInsightCache_expiresAt_idx" ON "AIInsightCache"("expiresAt");

-- CreateIndex
CREATE INDEX "AIInsightCache_promptVersion_idx" ON "AIInsightCache"("promptVersion");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_expiresAt_idx" ON "AIConversation"("expiresAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AIFeedback_insightId_key" ON "AIFeedback"("insightId");

-- CreateIndex
CREATE INDEX "AIFeedback_userId_idx" ON "AIFeedback"("userId");

-- CreateIndex
CREATE INDEX "AIFeedback_insightId_idx" ON "AIFeedback"("insightId");

-- CreateIndex
CREATE INDEX "AIFeedback_type_idx" ON "AIFeedback"("type");

-- CreateIndex
CREATE INDEX "AIFeedback_createdAt_idx" ON "AIFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "_BloodRequestItemToBloodUnitReservation_B_index" ON "_BloodRequestItemToBloodUnitReservation"("B");

-- CreateIndex
CREATE INDEX "_LaboratoryProfileToTestType_B_index" ON "_LaboratoryProfileToTestType"("B");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodCenter" ADD CONSTRAINT "BloodCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorProfile" ADD CONSTRAINT "DonorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AppointmentSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationEvent" ADD CONSTRAINT "DonationEvent_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationEvent" ADD CONSTRAINT "DonationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationEvent" ADD CONSTRAINT "DonationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAssessment" ADD CONSTRAINT "DonationAssessment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationAssessment" ADD CONSTRAINT "DonationAssessment_assessedBy_fkey" FOREIGN KEY ("assessedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitReservation" ADD CONSTRAINT "BloodUnitReservation_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitReservation" ADD CONSTRAINT "BloodUnitReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitReservation" ADD CONSTRAINT "BloodUnitReservation_reservedForOrganizationId_fkey" FOREIGN KEY ("reservedForOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitReservation" ADD CONSTRAINT "BloodUnitReservation_reservedBy_fkey" FOREIGN KEY ("reservedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_requestingOrganizationId_fkey" FOREIGN KEY ("requestingOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_fulfillingOrganizationId_fkey" FOREIGN KEY ("fulfillingOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestItem" ADD CONSTRAINT "BloodRequestItem_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestEvent" ADD CONSTRAINT "BloodRequestEvent_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestEvent" ADD CONSTRAINT "BloodRequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestEvent" ADD CONSTRAINT "BloodRequestEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationOrganizationId_fkey" FOREIGN KEY ("destinationOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentUnit" ADD CONSTRAINT "ShipmentUnit_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentUnit" ADD CONSTRAINT "ShipmentUnit_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentUnit" ADD CONSTRAINT "ShipmentUnit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "BloodUnitReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentUnit" ADD CONSTRAINT "ShipmentUnit_bloodRequestItemId_fkey" FOREIGN KEY ("bloodRequestItemId") REFERENCES "BloodRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLocation" ADD CONSTRAINT "ShipmentLocation_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLocation" ADD CONSTRAINT "ShipmentLocation_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyMatch" ADD CONSTRAINT "EmergencyMatch_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyMatch" ADD CONSTRAINT "EmergencyMatch_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResponse" ADD CONSTRAINT "EmergencyResponse_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "EmergencyMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyLocation" ADD CONSTRAINT "EmergencyLocation_emergencyResponseId_fkey" FOREIGN KEY ("emergencyResponseId") REFERENCES "EmergencyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "TestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReferenceRange" ADD CONSTRAINT "TestReferenceRange_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "TestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReferenceRange" ADD CONSTRAINT "TestReferenceRange_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryProfile" ADD CONSTRAINT "LaboratoryProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResult" ADD CONSTRAINT "LaboratoryResult_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResult" ADD CONSTRAINT "LaboratoryResult_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResult" ADD CONSTRAINT "LaboratoryResult_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResult" ADD CONSTRAINT "LaboratoryResult_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "TestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResultItem" ADD CONSTRAINT "LaboratoryResultItem_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LaboratoryResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResultItem" ADD CONSTRAINT "LaboratoryResultItem_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaboratoryResultVersion" ADD CONSTRAINT "LaboratoryResultVersion_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LaboratoryResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationProfile" ADD CONSTRAINT "GamificationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GamificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GamificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationTransaction" ADD CONSTRAINT "ReputationTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GamificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationProgress" ADD CONSTRAINT "EducationProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationProgress" ADD CONSTRAINT "EducationProgress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "EducationalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "AIInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BloodRequestItemToBloodUnitReservation" ADD CONSTRAINT "_BloodRequestItemToBloodUnitReservation_A_fkey" FOREIGN KEY ("A") REFERENCES "BloodRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BloodRequestItemToBloodUnitReservation" ADD CONSTRAINT "_BloodRequestItemToBloodUnitReservation_B_fkey" FOREIGN KEY ("B") REFERENCES "BloodUnitReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LaboratoryProfileToTestType" ADD CONSTRAINT "_LaboratoryProfileToTestType_A_fkey" FOREIGN KEY ("A") REFERENCES "LaboratoryProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LaboratoryProfileToTestType" ADD CONSTRAINT "_LaboratoryProfileToTestType_B_fkey" FOREIGN KEY ("B") REFERENCES "TestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
