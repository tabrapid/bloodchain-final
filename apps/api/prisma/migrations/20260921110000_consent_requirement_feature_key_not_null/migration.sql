-- `ConsentRequirement.featureKey` participates in a unique index, so it cannot
-- be nullable.
--
-- Postgres treats NULLs as distinct in a unique index, so
-- @@unique([scopeKey, purpose, featureKey]) would not have constrained
-- anything for the common case -- a purpose configured for the deployment as a
-- whole, with no particular feature. The same purpose could have been
-- configured twice, with contradictory modes, and nothing would have refused
-- it. The empty string is the "no particular feature" value now, the same
-- device `scopeKey` uses for "no particular organisation".
--
-- Nothing is in flight: the table ships empty and its first rows are written by
-- the reference seed.
UPDATE "ConsentRequirement" SET "featureKey" = '' WHERE "featureKey" IS NULL;
ALTER TABLE "ConsentRequirement" ALTER COLUMN "featureKey" SET DEFAULT '';
ALTER TABLE "ConsentRequirement" ALTER COLUMN "featureKey" SET NOT NULL;
