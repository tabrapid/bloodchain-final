-- Convert LaboratoryResult.status and LaboratoryResultVersion.status from
-- free-text to a typed enum.
--
-- Written by hand: `prisma migrate dev` proposed DROP COLUMN + ADD COLUMN for
-- both, which discards every existing result's status. An explicit USING cast
-- preserves the rows, and every value present in the data
-- (PENDING/ENTERED/REVIEWED/PUBLISHED) is a member of the new type, so the
-- cast cannot fail. Defaults are dropped before the type change and restored
-- after, because a text default is not assignable to an enum column.

-- CreateEnum
CREATE TYPE "LaboratoryResultStatus" AS ENUM ('PENDING', 'ENTERED', 'REVIEWED', 'PUBLISHED');

-- Fail loudly rather than silently mangling data if any row holds a value the
-- new type does not contain.
DO $$
DECLARE
  offending TEXT;
BEGIN
  SELECT string_agg(DISTINCT status, ', ') INTO offending
  FROM (
    SELECT status FROM "LaboratoryResult"
    UNION ALL
    SELECT status FROM "LaboratoryResultVersion"
  ) AS all_statuses
  WHERE status NOT IN ('PENDING', 'ENTERED', 'REVIEWED', 'PUBLISHED');

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot migrate laboratory result status: unexpected value(s) present: %', offending;
  END IF;
END $$;

-- AlterTable: LaboratoryResult
ALTER TABLE "LaboratoryResult" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LaboratoryResult"
  ALTER COLUMN "status" TYPE "LaboratoryResultStatus"
  USING "status"::"LaboratoryResultStatus";
ALTER TABLE "LaboratoryResult" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable: LaboratoryResultVersion (no default on this column)
ALTER TABLE "LaboratoryResultVersion"
  ALTER COLUMN "status" TYPE "LaboratoryResultStatus"
  USING "status"::"LaboratoryResultStatus";
