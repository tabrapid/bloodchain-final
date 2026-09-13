-- CreateEnum
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('REGISTRATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "purpose" "PhoneVerificationPurpose" NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedIp" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneVerification_phone_purpose_createdAt_idx" ON "PhoneVerification"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerification_expiresAt_idx" ON "PhoneVerification"("expiresAt");

-- Normalise stored phone numbers to E.164.
--
-- `User.phone` was written as typed, so the same number could be stored as
-- `+998901234567`, `998 90 123 45 67` and `901234567`. It is an identity from
-- now on -- a donor signs in with it and an SMS is sent to it -- and its
-- uniqueness only means something if one number has one spelling.
--
-- Rows whose canonical form would collide with another account are left exactly
-- as they are. Two accounts that share a number is a product decision about
-- which one is real, not something a migration should make at deploy time; and
-- failing the deploy over it would take the API down instead.
WITH normalised AS (
  SELECT
    u."id",
    CASE
      -- Already international, and not Uzbek: keep the country the user typed.
      WHEN d LIKE '+%' AND d NOT LIKE '+998%' THEN d
      WHEN d LIKE '+998%' AND substring(d from 5) ~ '^[1-9][0-9]{8}$' THEN d
      WHEN d ~ '^00998[1-9][0-9]{8}$' THEN '+' || substring(d from 3)
      WHEN d ~ '^998[1-9][0-9]{8}$'   THEN '+' || d
      WHEN d ~ '^[1-9][0-9]{8}$'      THEN '+998' || d
      -- The old domestic trunk prefix.
      WHEN d ~ '^8[1-9][0-9]{8}$'     THEN '+998' || substring(d from 2)
      ELSE u."phone"
    END AS canonical
  FROM (
    SELECT "id", "phone", regexp_replace("phone", '[^0-9+]', '', 'g') AS d
    FROM "User"
    WHERE "phone" IS NOT NULL
  ) u
)
UPDATE "User" AS target
SET "phone" = n.canonical
FROM normalised n
WHERE target."id" = n."id"
  AND n.canonical IS DISTINCT FROM target."phone"
  AND NOT EXISTS (
    SELECT 1 FROM "User" other
    WHERE other."phone" = n.canonical AND other."id" <> n."id"
  );
