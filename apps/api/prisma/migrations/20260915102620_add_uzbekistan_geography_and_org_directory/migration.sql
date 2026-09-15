-- Sprint 2: Uzbekistan geography + organization directory.
--
-- Additive only. No column is dropped, renamed or retyped; no existing row is
-- deleted; every new column is nullable or carries a default. Organization ids,
-- appointments and memberships are untouched, so an older API build keeps
-- working against this schema and a newer one keeps working against older data.
--
-- The two backfills at the end preserve behaviour rather than inventing facts:
-- before this migration every active hospital and blood centre was bookable for
-- a donation, and every organization holding a LaboratoryProfile was already
-- running laboratory work. Defaulting those flags to false without the backfill
-- would silently empty the booking list.

-- CreateEnum
CREATE TYPE "GeoDataSource" AS ENUM ('OFFICIAL_REFERENCE', 'DEMO');

-- CreateEnum
CREATE TYPE "OrganizationServiceType" AS ENUM ('WHOLE_BLOOD_DONATION', 'PLASMA_DONATION', 'PLATELET_DONATION', 'LABORATORY_TESTING', 'BLOOD_TYPING', 'HEALTH_SCREENING', 'MOBILE_DONATION_DRIVE', 'EMERGENCY_SUPPLY');

-- AlterTable
ALTER TABLE "DonorProfile" ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "regionId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "acceptsDonations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "directionsNote" VARCHAR(300),
ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providesLaboratory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicPhone" VARCHAR(32),
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "nameUz" VARCHAR(120) NOT NULL,
    "nameRu" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "centerEn" VARCHAR(120),
    "source" "GeoDataSource" NOT NULL DEFAULT 'OFFICIAL_REFERENCE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "nameUz" VARCHAR(120) NOT NULL,
    "nameRu" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "source" "GeoDataSource" NOT NULL DEFAULT 'DEMO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationService" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "service" "OrganizationServiceType" NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationHours" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "opensAt" VARCHAR(5),
    "closesAt" VARCHAR(5),
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_source_idx" ON "Region"("source");

-- CreateIndex
CREATE INDEX "Region_sortOrder_idx" ON "Region"("sortOrder");

-- CreateIndex
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

-- CreateIndex
CREATE INDEX "District_source_idx" ON "District"("source");

-- CreateIndex
CREATE UNIQUE INDEX "District_regionId_code_key" ON "District"("regionId", "code");

-- CreateIndex
CREATE INDEX "OrganizationService_service_idx" ON "OrganizationService"("service");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationService_organizationId_service_key" ON "OrganizationService"("organizationId", "service");

-- CreateIndex
CREATE INDEX "OrganizationHours_organizationId_idx" ON "OrganizationHours"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationHours_organizationId_dayOfWeek_key" ON "OrganizationHours"("organizationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DonorProfile_regionId_idx" ON "DonorProfile"("regionId");

-- CreateIndex
CREATE INDEX "DonorProfile_districtId_idx" ON "DonorProfile"("districtId");

-- CreateIndex
CREATE INDEX "Organization_regionId_idx" ON "Organization"("regionId");

-- CreateIndex
CREATE INDEX "Organization_districtId_idx" ON "Organization"("districtId");

-- CreateIndex
CREATE INDEX "Organization_acceptsDonations_idx" ON "Organization"("acceptsDonations");

-- CreateIndex
CREATE INDEX "Organization_providesLaboratory_idx" ON "Organization"("providesLaboratory");

-- CreateIndex
CREATE INDEX "Organization_verifiedAt_idx" ON "Organization"("verifiedAt");

-- CreateIndex
CREATE INDEX "Organization_isDemo_idx" ON "Organization"("isDemo");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationHours" ADD CONSTRAINT "OrganizationHours_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorProfile" ADD CONSTRAINT "DonorProfile_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorProfile" ADD CONSTRAINT "DonorProfile_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: what these organizations were already doing.
--
-- `acceptsDonations` defaults to false for new rows, which is the right default
-- for a directory entry nobody has filled in yet -- but wrong for rows that
-- predate the column, because donors have been booking donations at them all
-- along. Restricted to ACTIVE hospitals and blood centres; SYSTEM is the
-- internal placeholder org and is never bookable.
UPDATE "Organization"
SET "acceptsDonations" = true
WHERE "type" IN ('HOSPITAL', 'BLOOD_CENTER')
  AND "status" = 'ACTIVE';

-- Derived from a row that already exists, not asserted: an organization has a
-- LaboratoryProfile precisely when it runs laboratory testing.
UPDATE "Organization" o
SET "providesLaboratory" = true
WHERE EXISTS (
  SELECT 1 FROM "LaboratoryProfile" lp WHERE lp."organizationId" = o."id"
);
