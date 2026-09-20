-- Sprint 9: traceability, components, cold chain and privacy foundation.
--
-- The structural change underneath everything else is that a donation may now
-- yield more than one component. `BloodUnit.donationId` loses its UNIQUE index;
-- each component is its own BloodUnit row, so reservations, movements,
-- shipments, release decisions and dispositions keep working against it
-- unchanged rather than being duplicated into a parallel component model.
--
-- That UNIQUE index was also, by accident, the only live guard against a
-- double-submitted donation completion. It is replaced in the same commit by a
-- conditional claim inside the completion transaction; see
-- `DonationsService.completeDonation`.
--
-- NOTHING CLINICAL, LEGAL OR OPERATIONAL IS SEEDED BY THIS MIGRATION. No
-- storage temperature, no component shelf life, no test panel, no consent
-- wording, no retention period. The tables that would hold those values are
-- created empty on purpose, and the code refuses to proceed in production
-- rather than inventing a value -- the same fail-closed posture as Sprint 7's
-- clinical release gate.

-- CreateEnum
CREATE TYPE "BloodUnitHoldKind" AS ENUM ('REACTIVE', 'ABO_DISCREPANCY', 'TEMPERATURE_EXCURSION', 'DAMAGED', 'QUALITY_HOLD');

-- CreateEnum
CREATE TYPE "BloodUnitHoldStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ColdChainEventType" AS ENUM ('STORAGE', 'TRANSPORT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "TemperatureSource" AS ENUM ('DEVICE_LOGGER', 'MANUAL_READING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContainerIntegrity" AS ENUM ('INTACT', 'COMPROMISED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('CORE_ACCOUNT', 'HEALTH_DONATION_DATA', 'HEALTHCARE_SHARING', 'EMERGENCY_MATCHING', 'EMERGENCY_LIVE_LOCATION', 'SERVICE_NOTIFICATIONS', 'MARKETING_COMMUNICATIONS', 'CROSS_BORDER_PROCESSING');

-- CreateEnum
CREATE TYPE "ConsentDocumentStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConsentRequirementMode" AS ENUM ('REQUIRED_FOR_FEATURE', 'OPTIONAL', 'NOTICE_ONLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConsentAcceptanceSource" AS ENUM ('MOBILE_APP', 'WEB_CONSOLE', 'STAFF_RECORDED', 'MIGRATION');

-- CreateEnum
CREATE TYPE "RetentionMode" AS ENUM ('ACTIVE', 'ARCHIVED_RESTRICTED', 'DELETABLE', 'LEGAL_HOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DispositionType" ADD VALUE 'TRANSFUSED';
ALTER TYPE "DispositionType" ADD VALUE 'RETURNED';
ALTER TYPE "DispositionType" ADD VALUE 'DISCARDED_AT_HOSPITAL';
ALTER TYPE "DispositionType" ADD VALUE 'REACTION_REPORTED';
ALTER TYPE "DispositionType" ADD VALUE 'UNACCOUNTED_FOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'COMPONENT_PREPARED';
ALTER TYPE "MovementType" ADD VALUE 'HELD';
ALTER TYPE "MovementType" ADD VALUE 'HOLD_RESOLVED';
ALTER TYPE "MovementType" ADD VALUE 'DELIVERY_FAILED_RETURN';
ALTER TYPE "MovementType" ADD VALUE 'DELIVERY_DISCREPANCY_RETURN';

-- DropForeignKey
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_bloodUnitId_fkey";

-- DropIndex
DROP INDEX "BloodUnit_donationId_key";

-- AlterTable
ALTER TABLE "BloodUnit" ADD COLUMN     "parentUnitId" TEXT,
ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "processingAttributes" TEXT[],
ADD COLUMN     "storagePolicyId" TEXT;

-- AlterTable
ALTER TABLE "BloodUnitDisposition" ADD COLUMN     "context" TEXT,
ADD COLUMN     "encounterReference" VARCHAR(120);

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "coldChainEventId" TEXT,
ADD COLUMN     "containerReference" VARCHAR(120),
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchedBy" TEXT,
ADD COLUMN     "fromStatus" "BloodUnitStatus",
ADD COLUMN     "holdId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "scanReference" VARCHAR(120),
ADD COLUMN     "sealReference" VARCHAR(120),
ADD COLUMN     "sequence" INTEGER,
ADD COLUMN     "toStatus" "BloodUnitStatus";

-- Backfill the custody ledger's ordering.
--
-- `sequence` is NOT NULL and unique per unit, but existing rows have no order
-- to inherit beyond `createdAt` -- which, being transaction-start time, is
-- identical for every row written in one transaction. That is the very defect
-- this column exists to fix, so the backfill cannot recover an order that was
-- never recorded. It establishes one instead: `createdAt` first, then `id` to
-- break the ties deterministically, so the same database always produces the
-- same numbering and the unique constraint below can be enforced.
--
-- Rows numbered here carry an order that is reconstructed, not observed. Rows
-- written from now on carry one that was.
UPDATE "InventoryMovement" m
SET "sequence" = ordered.rn
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "bloodUnitId" ORDER BY "createdAt", "id") AS rn
  FROM "InventoryMovement"
) AS ordered
WHERE m."id" = ordered."id";

ALTER TABLE "InventoryMovement" ALTER COLUMN "sequence" SET NOT NULL;

-- CreateTable
CREATE TABLE "DonationSample" (
    "id" TEXT NOT NULL,
    "sampleReference" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sampleType" VARCHAR(80),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoragePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConsentDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "requirementText" TEXT,
    "sourceReference" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoragePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnitHold" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "BloodUnitHoldKind" NOT NULL,
    "status" "BloodUnitHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reasonCode" VARCHAR(80),
    "reasonText" TEXT,
    "raisedBy" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionText" TEXT,
    "coldChainEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodUnitHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdChainEvent" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT,
    "shipmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "type" "ColdChainEventType" NOT NULL,
    "deviceReference" VARCHAR(120),
    "containerReference" VARCHAR(120),
    "loggerReference" VARCHAR(120),
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "temperatureC" DECIMAL(5,1),
    "source" "TemperatureSource" NOT NULL DEFAULT 'UNKNOWN',
    "calibratedAt" TIMESTAMP(3),
    "calibrationReference" VARCHAR(120),
    "sealIntact" "ContainerIntegrity" NOT NULL DEFAULT 'UNKNOWN',
    "excursionDeclared" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentDocument" (
    "id" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "organizationId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT,
    "contentReference" TEXT,
    "contentHash" VARCHAR(64) NOT NULL,
    "status" "ConsentDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "organizationId" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "source" "ConsentAcceptanceSource" NOT NULL DEFAULT 'MOBILE_APP',
    "clientReference" VARCHAR(120),
    "context" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequirement" (
    "id" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "organizationId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "mode" "ConsentRequirementMode" NOT NULL,
    "featureKey" VARCHAR(80),
    "note" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "organizationId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "mode" "RetentionMode" NOT NULL,
    "authorityReference" TEXT,
    "legalHoldUntil" TIMESTAMP(3),
    "legalHoldReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonationSample_sampleReference_key" ON "DonationSample"("sampleReference");

-- CreateIndex
CREATE INDEX "DonationSample_donationId_idx" ON "DonationSample"("donationId");

-- CreateIndex
CREATE INDEX "DonationSample_organizationId_idx" ON "DonationSample"("organizationId");

-- CreateIndex
CREATE INDEX "DonationSample_sampleReference_idx" ON "DonationSample"("sampleReference");

-- CreateIndex
CREATE INDEX "StoragePolicy_organizationId_idx" ON "StoragePolicy"("organizationId");

-- CreateIndex
CREATE INDEX "StoragePolicy_status_idx" ON "StoragePolicy"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StoragePolicy_scopeKey_code_version_key" ON "StoragePolicy"("scopeKey", "code", "version");

-- CreateIndex
CREATE INDEX "BloodUnitHold_bloodUnitId_idx" ON "BloodUnitHold"("bloodUnitId");

-- CreateIndex
CREATE INDEX "BloodUnitHold_organizationId_idx" ON "BloodUnitHold"("organizationId");

-- CreateIndex
CREATE INDEX "BloodUnitHold_status_idx" ON "BloodUnitHold"("status");

-- CreateIndex
CREATE INDEX "BloodUnitHold_kind_idx" ON "BloodUnitHold"("kind");

-- CreateIndex
CREATE INDEX "BloodUnitHold_raisedAt_idx" ON "BloodUnitHold"("raisedAt");

-- CreateIndex
CREATE INDEX "ColdChainEvent_bloodUnitId_idx" ON "ColdChainEvent"("bloodUnitId");

-- CreateIndex
CREATE INDEX "ColdChainEvent_shipmentId_idx" ON "ColdChainEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ColdChainEvent_organizationId_idx" ON "ColdChainEvent"("organizationId");

-- CreateIndex
CREATE INDEX "ColdChainEvent_type_idx" ON "ColdChainEvent"("type");

-- CreateIndex
CREATE INDEX "ColdChainEvent_measuredAt_idx" ON "ColdChainEvent"("measuredAt");

-- CreateIndex
CREATE INDEX "ColdChainEvent_excursionDeclared_idx" ON "ColdChainEvent"("excursionDeclared");

-- CreateIndex
CREATE INDEX "ConsentDocument_purpose_idx" ON "ConsentDocument"("purpose");

-- CreateIndex
CREATE INDEX "ConsentDocument_status_idx" ON "ConsentDocument"("status");

-- CreateIndex
CREATE INDEX "ConsentDocument_organizationId_idx" ON "ConsentDocument"("organizationId");

-- CreateIndex
CREATE INDEX "ConsentDocument_effectiveAt_idx" ON "ConsentDocument"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDocument_scopeKey_purpose_locale_version_key" ON "ConsentDocument"("scopeKey", "purpose", "locale", "version");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_userId_idx" ON "ConsentAcceptance"("userId");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_documentId_idx" ON "ConsentAcceptance"("documentId");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_purpose_idx" ON "ConsentAcceptance"("purpose");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_acceptedAt_idx" ON "ConsentAcceptance"("acceptedAt");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_withdrawnAt_idx" ON "ConsentAcceptance"("withdrawnAt");

-- CreateIndex
CREATE INDEX "ConsentRequirement_purpose_idx" ON "ConsentRequirement"("purpose");

-- CreateIndex
CREATE INDEX "ConsentRequirement_mode_idx" ON "ConsentRequirement"("mode");

-- CreateIndex
CREATE INDEX "ConsentRequirement_organizationId_idx" ON "ConsentRequirement"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRequirement_scopeKey_purpose_featureKey_key" ON "ConsentRequirement"("scopeKey", "purpose", "featureKey");

-- CreateIndex
CREATE INDEX "RetentionPolicy_category_idx" ON "RetentionPolicy"("category");

-- CreateIndex
CREATE INDEX "RetentionPolicy_mode_idx" ON "RetentionPolicy"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_scopeKey_category_key" ON "RetentionPolicy"("scopeKey", "category");

-- CreateIndex
CREATE INDEX "BloodUnit_parentUnitId_idx" ON "BloodUnit"("parentUnitId");

-- CreateIndex
CREATE INDEX "BloodUnit_storagePolicyId_idx" ON "BloodUnit"("storagePolicyId");

-- CreateIndex
CREATE INDEX "BloodUnitDisposition_organizationId_recipientReference_idx" ON "BloodUnitDisposition"("organizationId", "recipientReference");

-- CreateIndex
CREATE INDEX "InventoryMovement_holdId_idx" ON "InventoryMovement"("holdId");

-- CreateIndex
CREATE INDEX "InventoryMovement_coldChainEventId_idx" ON "InventoryMovement"("coldChainEventId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_bloodUnitId_sequence_key" ON "InventoryMovement"("bloodUnitId", "sequence");

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_storagePolicyId_fkey" FOREIGN KEY ("storagePolicyId") REFERENCES "StoragePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_dispatchedBy_fkey" FOREIGN KEY ("dispatchedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "BloodUnitHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_coldChainEventId_fkey" FOREIGN KEY ("coldChainEventId") REFERENCES "ColdChainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSample" ADD CONSTRAINT "DonationSample_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSample" ADD CONSTRAINT "DonationSample_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSample" ADD CONSTRAINT "DonationSample_collectedBy_fkey" FOREIGN KEY ("collectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePolicy" ADD CONSTRAINT "StoragePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePolicy" ADD CONSTRAINT "StoragePolicy_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitHold" ADD CONSTRAINT "BloodUnitHold_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitHold" ADD CONSTRAINT "BloodUnitHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitHold" ADD CONSTRAINT "BloodUnitHold_raisedBy_fkey" FOREIGN KEY ("raisedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitHold" ADD CONSTRAINT "BloodUnitHold_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitHold" ADD CONSTRAINT "BloodUnitHold_coldChainEventId_fkey" FOREIGN KEY ("coldChainEventId") REFERENCES "ColdChainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainEvent" ADD CONSTRAINT "ColdChainEvent_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainEvent" ADD CONSTRAINT "ColdChainEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainEvent" ADD CONSTRAINT "ColdChainEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainEvent" ADD CONSTRAINT "ColdChainEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentDocument" ADD CONSTRAINT "ConsentDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentDocument" ADD CONSTRAINT "ConsentDocument_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ConsentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequirement" ADD CONSTRAINT "ConsentRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

