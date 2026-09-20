-- CreateEnum
CREATE TYPE "DeferralKind" AS ENUM ('TEMPORARY', 'INDEFINITE');

-- CreateEnum
CREATE TYPE "DeferralSource" AS ENUM ('DONATION_ASSESSMENT', 'STAFF_DECISION', 'MIGRATED');

-- CreateEnum
CREATE TYPE "ClinicalReleasePolicyStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClinicalReleasePolicyKind" AS ENUM ('PRODUCTION', 'DEVELOPMENT_ONLY');

-- CreateEnum
CREATE TYPE "ReleaseDecisionOutcome" AS ENUM ('RELEASED', 'REFUSED');

-- CreateEnum
CREATE TYPE "BloodGroupProvenance" AS ENUM ('DONOR_PROFILE_COPY', 'STAFF_RECORDED_AT_COLLECTION', 'UNIT_TYPED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExpiryProvenance" AS ENUM ('UNKNOWN', 'DEVELOPMENT_POLICY', 'CLINICAL_POLICY', 'STAFF_RECORDED');

-- CreateEnum
CREATE TYPE "DispositionType" AS ENUM ('ISSUED', 'DISCARDED', 'EXPIRED', 'TRANSFERRED_OUT');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'LOW_STOCK_THRESHOLD_NOT_CONFIGURED';

-- AlterTable
ALTER TABLE "BloodUnit" ADD COLUMN     "bloodGroupSource" "BloodGroupProvenance" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "bloodGroupSourceNote" VARCHAR(120),
ADD COLUMN     "clinicalReleasedAt" TIMESTAMP(3),
ADD COLUMN     "expirySource" "ExpiryProvenance" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "DonorDeferral" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "kind" "DeferralKind" NOT NULL,
    "reasonCode" VARCHAR(80),
    "reasonText" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "source" "DeferralSource" NOT NULL,
    "sourceDonationId" TEXT,
    "createdBy" TEXT,
    "liftedAt" TIMESTAMP(3),
    "liftedBy" TEXT,
    "liftReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorDeferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalReleasePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ClinicalReleasePolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "kind" "ClinicalReleasePolicyKind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "sourceReference" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "developmentShelfLifeDays" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalReleasePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalReleaseRequirement" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "componentType" "ComponentType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalReleaseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseDecision" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT,
    "policyVersion" INTEGER,
    "policyKind" "ClinicalReleasePolicyKind",
    "outcome" "ReleaseDecisionOutcome" NOT NULL,
    "reasonCode" VARCHAR(80) NOT NULL,
    "unmetRequirements" TEXT[],
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnitDisposition" (
    "id" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "DispositionType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "recipientReference" VARCHAR(120),
    "bloodRequestId" TEXT,
    "shipmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodUnitDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryThreshold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scopeKey" VARCHAR(80) NOT NULL,
    "bloodType" "BloodType",
    "rhFactor" "RhFactor",
    "componentType" "ComponentType",
    "lowStockThreshold" INTEGER NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonorDeferral_donorId_idx" ON "DonorDeferral"("donorId");

-- CreateIndex
CREATE INDEX "DonorDeferral_donorId_liftedAt_idx" ON "DonorDeferral"("donorId", "liftedAt");

-- CreateIndex
CREATE INDEX "DonorDeferral_startsAt_idx" ON "DonorDeferral"("startsAt");

-- CreateIndex
CREATE INDEX "DonorDeferral_endsAt_idx" ON "DonorDeferral"("endsAt");

-- CreateIndex
CREATE INDEX "DonorDeferral_organizationId_idx" ON "DonorDeferral"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicalReleasePolicy_organizationId_idx" ON "ClinicalReleasePolicy"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicalReleasePolicy_status_idx" ON "ClinicalReleasePolicy"("status");

-- CreateIndex
CREATE INDEX "ClinicalReleasePolicy_kind_idx" ON "ClinicalReleasePolicy"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalReleasePolicy_scopeKey_version_key" ON "ClinicalReleasePolicy"("scopeKey", "version");

-- CreateIndex
CREATE INDEX "ClinicalReleaseRequirement_policyId_idx" ON "ClinicalReleaseRequirement"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalReleaseRequirement_policyId_code_key" ON "ClinicalReleaseRequirement"("policyId", "code");

-- CreateIndex
CREATE INDEX "ReleaseDecision_bloodUnitId_idx" ON "ReleaseDecision"("bloodUnitId");

-- CreateIndex
CREATE INDEX "ReleaseDecision_organizationId_idx" ON "ReleaseDecision"("organizationId");

-- CreateIndex
CREATE INDEX "ReleaseDecision_outcome_idx" ON "ReleaseDecision"("outcome");

-- CreateIndex
CREATE INDEX "ReleaseDecision_decidedAt_idx" ON "ReleaseDecision"("decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BloodUnitDisposition_bloodUnitId_key" ON "BloodUnitDisposition"("bloodUnitId");

-- CreateIndex
CREATE INDEX "BloodUnitDisposition_organizationId_idx" ON "BloodUnitDisposition"("organizationId");

-- CreateIndex
CREATE INDEX "BloodUnitDisposition_type_idx" ON "BloodUnitDisposition"("type");

-- CreateIndex
CREATE INDEX "BloodUnitDisposition_occurredAt_idx" ON "BloodUnitDisposition"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryThreshold_organizationId_idx" ON "InventoryThreshold"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryThreshold_organizationId_scopeKey_key" ON "InventoryThreshold"("organizationId", "scopeKey");

-- CreateIndex
CREATE INDEX "BloodUnit_clinicalReleasedAt_idx" ON "BloodUnit"("clinicalReleasedAt");

-- AddForeignKey
ALTER TABLE "DonorDeferral" ADD CONSTRAINT "DonorDeferral_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorDeferral" ADD CONSTRAINT "DonorDeferral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorDeferral" ADD CONSTRAINT "DonorDeferral_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorDeferral" ADD CONSTRAINT "DonorDeferral_liftedBy_fkey" FOREIGN KEY ("liftedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorDeferral" ADD CONSTRAINT "DonorDeferral_sourceDonationId_fkey" FOREIGN KEY ("sourceDonationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReleasePolicy" ADD CONSTRAINT "ClinicalReleasePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReleasePolicy" ADD CONSTRAINT "ClinicalReleasePolicy_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReleasePolicy" ADD CONSTRAINT "ClinicalReleasePolicy_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReleaseRequirement" ADD CONSTRAINT "ClinicalReleaseRequirement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ClinicalReleasePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseDecision" ADD CONSTRAINT "ReleaseDecision_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseDecision" ADD CONSTRAINT "ReleaseDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseDecision" ADD CONSTRAINT "ReleaseDecision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ClinicalReleasePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseDecision" ADD CONSTRAINT "ReleaseDecision_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitDisposition" ADD CONSTRAINT "BloodUnitDisposition_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitDisposition" ADD CONSTRAINT "BloodUnitDisposition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitDisposition" ADD CONSTRAINT "BloodUnitDisposition_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitDisposition" ADD CONSTRAINT "BloodUnitDisposition_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnitDisposition" ADD CONSTRAINT "BloodUnitDisposition_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill: reconstruct a deferral for every donor already flagged DEFERRED.
--
-- `DonorProfile.donorStatus = DEFERRED` was a flag with no reason, no actor and
-- no date, so there is nothing to backfill those fields *with*. Inventing them
-- would put a fabricated clinical record on a real donor. Instead each becomes
-- an INDEFINITE deferral whose source is MIGRATED and whose text says exactly
-- what it is, dated from the profile row's own last update -- the only date
-- that has any relationship to the flag.
--
-- This runs before anything reads `isDeferredAt`, so a donor deferred under the
-- old flag stays deferred under the new model rather than silently becoming
-- bookable the moment the gate moves.
INSERT INTO "DonorDeferral" (
  "id", "donorId", "kind", "reasonText", "startsAt", "source", "createdAt", "updatedAt"
)
SELECT
  'mig_' || substr(md5(random()::text || p."userId"), 1, 21),
  p."userId",
  'INDEFINITE'::"DeferralKind",
  'Reconstructed by migration from DonorProfile.donorStatus = DEFERRED. The original flag recorded no reason, no actor and no date; none has been invented here.',
  p."updatedAt",
  'MIGRATED'::"DeferralSource",
  NOW(),
  NOW()
FROM "DonorProfile" p
WHERE p."donorStatus" = 'DEFERRED';

-- ---------------------------------------------------------------------------
-- Provenance for blood units that predate these columns.
--
-- Every existing unit took its group from the donor's profile and carries no
-- expiry at all, but this migration cannot prove that of any individual row --
-- it can only observe that the columns did not exist. So both stay UNKNOWN,
-- which is the honest answer and the one the release gate refuses to treat as
-- safe. Backfilling DONOR_PROFILE_COPY here would assert provenance nobody
-- recorded.
UPDATE "BloodUnit" SET "bloodGroupSource" = 'UNKNOWN' WHERE "bloodGroupSource" IS NULL;
