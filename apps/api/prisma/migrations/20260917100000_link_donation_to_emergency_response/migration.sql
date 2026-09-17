-- Sprint 3: link an emergency donation to the response that produced it.
--
-- Additive only. One nullable column, its indexes, and a foreign key that sets
-- the column null rather than deleting the donation. No existing column is
-- touched and no row is removed, so an older API build keeps working against
-- this schema and a newer one keeps working against older data.

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "emergencyResponseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Donation_emergencyResponseId_key" ON "Donation"("emergencyResponseId");

-- CreateIndex
CREATE INDEX "Donation_emergencyResponseId_idx" ON "Donation"("emergencyResponseId");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_emergencyResponseId_fkey" FOREIGN KEY ("emergencyResponseId") REFERENCES "EmergencyResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: recover the link that was already being written, just not as a column.
--
-- Every donation the emergency path created also wrote a DonationEvent whose
-- metadata carries the response id. That is a fact already in the database, not
-- an inference, so historical emergency donations keep their identity instead of
-- silently becoming routine ones the day this column arrives.
--
-- DISTINCT ON keeps the unique index honest if a donation somehow carries two
-- such events: the earliest COMPLETED event is the one that created it.
UPDATE "Donation" d
SET "emergencyResponseId" = source."responseId"
FROM (
  SELECT DISTINCT ON (e."donationId")
         e."donationId",
         e."metadata" ->> 'emergencyResponseId' AS "responseId"
  FROM "DonationEvent" e
  WHERE e."metadata" ->> 'source' = 'EMERGENCY'
    AND e."metadata" ->> 'emergencyResponseId' IS NOT NULL
  ORDER BY e."donationId", e."createdAt" ASC
) AS source
WHERE d."id" = source."donationId"
  AND d."emergencyResponseId" IS NULL
  AND EXISTS (SELECT 1 FROM "EmergencyResponse" r WHERE r."id" = source."responseId")
  -- A response already claimed by another donation must not be claimed twice;
  -- the unique index would reject the whole statement rather than one row.
  AND NOT EXISTS (
    SELECT 1 FROM "Donation" other
    WHERE other."emergencyResponseId" = source."responseId"
  );
