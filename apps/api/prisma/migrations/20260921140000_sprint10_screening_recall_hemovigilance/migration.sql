-- Sprint 10: blood-bank screening, recall and hemovigilance.
--
-- Purely additive. No column is dropped, no table is dropped, nothing is
-- rewritten, and every new column on an existing table is nullable or carries a
-- default -- so this applies to a populated Sprint 9 database without a
-- backfill and without data loss.
--
-- What it adds, and the one thing it deliberately does not:
--
--   * `ScreeningOrder`, `ScreeningResult`, `ScreeningResultRevision` and
--     `ScreeningDispositionRule` -- a blood-bank screening domain that is
--     SEPARATE from `LaboratoryResult`. The donor-facing diagnostics domain is
--     untouched by this migration; not one of its columns changes. That
--     separation is the point: `LaboratoryResult` is keyed 1:1 to an
--     appointment, owned by a donor and published to them, and its categories
--     are a wellness taxonomy. Blood-bank screening asks whether a UNIT is safe
--     to transfuse, per SAMPLE, and its results are never published to the
--     donor.
--   * `DonorStatus.MEDICAL_REVIEW_REQUIRED` and `DonorReviewTrigger` -- a
--     safety review state that is explicitly NOT a deferral. No DonorDeferral
--     row is created by screening, ever.
--   * `RecallCase`, `RecallAffectedComponent`, `RecallAcknowledgement` -- recall
--     as an additional axis carried alongside component status, never as a
--     rewrite of it.
--   * `HemovigilanceEvent` -- generic, with no reaction classification.
--
-- NO CLINICAL VALUE IS INTRODUCED. No marker, no assay, no NAT rule, no
-- threshold, no shelf life, no reaction category. `ScreeningDispositionRule`
-- ships empty, and an unmapped result is REVIEW_REQUIRED rather than CLEAR --
-- an unanswered question does not release blood.

-- CreateEnum
CREATE TYPE "DonationSampleStatus" AS ENUM ('COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'IN_TESTING', 'CONSUMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScreeningOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScreeningResultSource" AS ENUM ('MANUAL', 'ANALYZER', 'EXTERNAL_LAB');

-- CreateEnum
CREATE TYPE "SafetyDisposition" AS ENUM ('CLEAR', 'BLOCK', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DonorReviewTriggerStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DonorReviewResolution" AS ENUM ('RETURNED_TO_ACTIVE', 'TEMPORARY_DEFERRAL', 'INDEFINITE_DEFERRAL', 'REMAINS_UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "RecallCaseStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecallComponentState" AS ENUM ('IDENTIFIED', 'QUARANTINED', 'RETURNED', 'DESTROYED', 'TRANSFUSED_BEFORE_RECALL', 'UNACCOUNTED');

-- CreateEnum
CREATE TYPE "HemovigilanceStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'CLOSED');

-- AlterEnum
ALTER TYPE "DonorStatus" ADD VALUE 'MEDICAL_REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "ClinicalReleasePolicy" ADD COLUMN     "requiresResultReview" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sopReference" TEXT;

-- AlterTable
ALTER TABLE "ClinicalReleaseRequirement" ADD COLUMN     "screeningTestCode" VARCHAR(80);

-- AlterTable
ALTER TABLE "DonationSample" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" VARCHAR(120),
ADD COLUMN     "status" "DonationSampleStatus" NOT NULL DEFAULT 'COLLECTED';

-- CreateTable
CREATE TABLE "ScreeningDispositionRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "requirementCode" VARCHAR(80) NOT NULL,
    "resultCode" VARCHAR(80) NOT NULL,
    "disposition" "SafetyDisposition" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningDispositionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningOrder" (
    "id" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "sampleId" TEXT,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "status" "ScreeningOrderStatus" NOT NULL DEFAULT 'OPEN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "systemRaised" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResult" (
    "id" TEXT NOT NULL,
    "screeningOrderId" TEXT NOT NULL,
    "requirementId" TEXT,
    "requirementCode" VARCHAR(80) NOT NULL,
    "sampleId" TEXT,
    "resultCode" VARCHAR(80) NOT NULL,
    "resultValue" TEXT,
    "disposition" "SafetyDisposition" NOT NULL,
    "dispositionPolicyVersion" INTEGER,
    "source" "ScreeningResultSource" NOT NULL DEFAULT 'MANUAL',
    "methodReference" VARCHAR(120),
    "reagentReference" VARCHAR(120),
    "reagentLot" VARCHAR(80),
    "reagentExpiresAt" TIMESTAMP(3),
    "analyzerReference" VARCHAR(120),
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededAt" TIMESTAMP(3),
    "comment" TEXT,
    "confidentialComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResultRevision" (
    "id" TEXT NOT NULL,
    "originalResultId" TEXT NOT NULL,
    "replacementResultId" TEXT,
    "originalResultCode" VARCHAR(80) NOT NULL,
    "correctedResultCode" VARCHAR(80) NOT NULL,
    "originalDisposition" "SafetyDisposition" NOT NULL,
    "correctedDisposition" "SafetyDisposition" NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedBy" TEXT,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recallCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningResultRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorReviewTrigger" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DonorReviewTriggerStatus" NOT NULL DEFAULT 'OPEN',
    "sourceKind" VARCHAR(60) NOT NULL,
    "screeningOrderId" TEXT,
    "screeningResultId" TEXT,
    "triggerDisposition" "SafetyDisposition" NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raisedBy" TEXT,
    "systemRaised" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" "DonorReviewResolution",
    "resolutionNote" TEXT,
    "resultingDeferralId" TEXT,
    "resultingDonorStatus" "DonorStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorReviewTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallCase" (
    "id" TEXT NOT NULL,
    "recallReference" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "RecallCaseStatus" NOT NULL DEFAULT 'OPEN',
    "triggerKind" VARCHAR(60) NOT NULL,
    "donationId" TEXT,
    "reasonCode" VARCHAR(80),
    "operationalReason" TEXT,
    "confidentialDetail" TEXT,
    "openedBy" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closureNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallAffectedComponent" (
    "id" TEXT NOT NULL,
    "recallCaseId" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "state" "RecallComponentState" NOT NULL DEFAULT 'IDENTIFIED',
    "statusAtRecall" "BloodUnitStatus",
    "holdingOrganizationId" TEXT,
    "shipmentId" TEXT,
    "holdId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallAffectedComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallAcknowledgement" (
    "id" TEXT NOT NULL,
    "recallCaseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecallAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HemovigilanceEvent" (
    "id" TEXT NOT NULL,
    "eventReference" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bloodUnitId" TEXT,
    "recipientReference" VARCHAR(120),
    "encounterReference" VARCHAR(120),
    "eventCode" VARCHAR(80),
    "status" "HemovigilanceStatus" NOT NULL DEFAULT 'REPORTED',
    "occurredAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedBy" TEXT,
    "confidentialNarrative" TEXT,
    "operationalSummary" TEXT,
    "investigationNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "recallCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HemovigilanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningDispositionRule_policyId_idx" ON "ScreeningDispositionRule"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningDispositionRule_policyId_requirementCode_resultCod_key" ON "ScreeningDispositionRule"("policyId", "requirementCode", "resultCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningOrder_orderReference_key" ON "ScreeningOrder"("orderReference");

-- CreateIndex
CREATE INDEX "ScreeningOrder_donationId_idx" ON "ScreeningOrder"("donationId");

-- CreateIndex
CREATE INDEX "ScreeningOrder_sampleId_idx" ON "ScreeningOrder"("sampleId");

-- CreateIndex
CREATE INDEX "ScreeningOrder_organizationId_idx" ON "ScreeningOrder"("organizationId");

-- CreateIndex
CREATE INDEX "ScreeningOrder_status_idx" ON "ScreeningOrder"("status");

-- CreateIndex
CREATE INDEX "ScreeningOrder_policyId_idx" ON "ScreeningOrder"("policyId");

-- CreateIndex
CREATE INDEX "ScreeningResult_screeningOrderId_idx" ON "ScreeningResult"("screeningOrderId");

-- CreateIndex
CREATE INDEX "ScreeningResult_requirementCode_idx" ON "ScreeningResult"("requirementCode");

-- CreateIndex
CREATE INDEX "ScreeningResult_disposition_idx" ON "ScreeningResult"("disposition");

-- CreateIndex
CREATE INDEX "ScreeningResult_superseded_idx" ON "ScreeningResult"("superseded");

-- CreateIndex
CREATE INDEX "ScreeningResult_sampleId_idx" ON "ScreeningResult"("sampleId");

-- CreateIndex
CREATE INDEX "ScreeningResultRevision_originalResultId_idx" ON "ScreeningResultRevision"("originalResultId");

-- CreateIndex
CREATE INDEX "ScreeningResultRevision_replacementResultId_idx" ON "ScreeningResultRevision"("replacementResultId");

-- CreateIndex
CREATE INDEX "ScreeningResultRevision_recallCaseId_idx" ON "ScreeningResultRevision"("recallCaseId");

-- CreateIndex
CREATE INDEX "DonorReviewTrigger_donorId_idx" ON "DonorReviewTrigger"("donorId");

-- CreateIndex
CREATE INDEX "DonorReviewTrigger_organizationId_idx" ON "DonorReviewTrigger"("organizationId");

-- CreateIndex
CREATE INDEX "DonorReviewTrigger_status_idx" ON "DonorReviewTrigger"("status");

-- CreateIndex
CREATE INDEX "DonorReviewTrigger_screeningOrderId_idx" ON "DonorReviewTrigger"("screeningOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RecallCase_recallReference_key" ON "RecallCase"("recallReference");

-- CreateIndex
CREATE INDEX "RecallCase_organizationId_idx" ON "RecallCase"("organizationId");

-- CreateIndex
CREATE INDEX "RecallCase_status_idx" ON "RecallCase"("status");

-- CreateIndex
CREATE INDEX "RecallCase_donationId_idx" ON "RecallCase"("donationId");

-- CreateIndex
CREATE INDEX "RecallCase_openedAt_idx" ON "RecallCase"("openedAt");

-- CreateIndex
CREATE INDEX "RecallAffectedComponent_recallCaseId_idx" ON "RecallAffectedComponent"("recallCaseId");

-- CreateIndex
CREATE INDEX "RecallAffectedComponent_bloodUnitId_idx" ON "RecallAffectedComponent"("bloodUnitId");

-- CreateIndex
CREATE INDEX "RecallAffectedComponent_state_idx" ON "RecallAffectedComponent"("state");

-- CreateIndex
CREATE UNIQUE INDEX "RecallAffectedComponent_recallCaseId_bloodUnitId_key" ON "RecallAffectedComponent"("recallCaseId", "bloodUnitId");

-- CreateIndex
CREATE INDEX "RecallAcknowledgement_recallCaseId_idx" ON "RecallAcknowledgement"("recallCaseId");

-- CreateIndex
CREATE INDEX "RecallAcknowledgement_organizationId_idx" ON "RecallAcknowledgement"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecallAcknowledgement_recallCaseId_organizationId_key" ON "RecallAcknowledgement"("recallCaseId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HemovigilanceEvent_eventReference_key" ON "HemovigilanceEvent"("eventReference");

-- CreateIndex
CREATE INDEX "HemovigilanceEvent_organizationId_idx" ON "HemovigilanceEvent"("organizationId");

-- CreateIndex
CREATE INDEX "HemovigilanceEvent_bloodUnitId_idx" ON "HemovigilanceEvent"("bloodUnitId");

-- CreateIndex
CREATE INDEX "HemovigilanceEvent_status_idx" ON "HemovigilanceEvent"("status");

-- CreateIndex
CREATE INDEX "HemovigilanceEvent_recallCaseId_idx" ON "HemovigilanceEvent"("recallCaseId");

-- CreateIndex
CREATE INDEX "DonationSample_status_idx" ON "DonationSample"("status");

-- AddForeignKey
ALTER TABLE "ScreeningDispositionRule" ADD CONSTRAINT "ScreeningDispositionRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ClinicalReleasePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSample" ADD CONSTRAINT "DonationSample_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSample" ADD CONSTRAINT "DonationSample_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "DonationSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ClinicalReleasePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOrder" ADD CONSTRAINT "ScreeningOrder_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_screeningOrderId_fkey" FOREIGN KEY ("screeningOrderId") REFERENCES "ScreeningOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ClinicalReleaseRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "DonationSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResultRevision" ADD CONSTRAINT "ScreeningResultRevision_originalResultId_fkey" FOREIGN KEY ("originalResultId") REFERENCES "ScreeningResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResultRevision" ADD CONSTRAINT "ScreeningResultRevision_replacementResultId_fkey" FOREIGN KEY ("replacementResultId") REFERENCES "ScreeningResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResultRevision" ADD CONSTRAINT "ScreeningResultRevision_correctedBy_fkey" FOREIGN KEY ("correctedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResultRevision" ADD CONSTRAINT "ScreeningResultRevision_recallCaseId_fkey" FOREIGN KEY ("recallCaseId") REFERENCES "RecallCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_screeningOrderId_fkey" FOREIGN KEY ("screeningOrderId") REFERENCES "ScreeningOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_screeningResultId_fkey" FOREIGN KEY ("screeningResultId") REFERENCES "ScreeningResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_raisedBy_fkey" FOREIGN KEY ("raisedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorReviewTrigger" ADD CONSTRAINT "DonorReviewTrigger_resultingDeferralId_fkey" FOREIGN KEY ("resultingDeferralId") REFERENCES "DonorDeferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAffectedComponent" ADD CONSTRAINT "RecallAffectedComponent_recallCaseId_fkey" FOREIGN KEY ("recallCaseId") REFERENCES "RecallCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAffectedComponent" ADD CONSTRAINT "RecallAffectedComponent_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAffectedComponent" ADD CONSTRAINT "RecallAffectedComponent_holdingOrganizationId_fkey" FOREIGN KEY ("holdingOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAffectedComponent" ADD CONSTRAINT "RecallAffectedComponent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAffectedComponent" ADD CONSTRAINT "RecallAffectedComponent_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "BloodUnitHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAcknowledgement" ADD CONSTRAINT "RecallAcknowledgement_recallCaseId_fkey" FOREIGN KEY ("recallCaseId") REFERENCES "RecallCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAcknowledgement" ADD CONSTRAINT "RecallAcknowledgement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallAcknowledgement" ADD CONSTRAINT "RecallAcknowledgement_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemovigilanceEvent" ADD CONSTRAINT "HemovigilanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemovigilanceEvent" ADD CONSTRAINT "HemovigilanceEvent_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemovigilanceEvent" ADD CONSTRAINT "HemovigilanceEvent_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemovigilanceEvent" ADD CONSTRAINT "HemovigilanceEvent_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemovigilanceEvent" ADD CONSTRAINT "HemovigilanceEvent_recallCaseId_fkey" FOREIGN KEY ("recallCaseId") REFERENCES "RecallCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

