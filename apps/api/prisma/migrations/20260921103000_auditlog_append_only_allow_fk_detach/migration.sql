-- Let referential integrity do its job, and nothing else.
--
-- The append-only trigger added in 20260921100000 was too broad, and the
-- e2e suite found it immediately: `AuditLog.actorId` and
-- `AuditLog.organizationId` are both `onDelete: SetNull`, and Postgres
-- implements SET NULL as an UPDATE on the referencing table. So deleting a
-- user -- which the account-deletion path must be able to do -- raised
-- "AuditLog is append-only" from a statement nobody wrote.
--
-- The fix is narrower than it sounds, and it does not weaken the control. An
-- audit entry says WHO did WHAT to WHICH record WHEN. Detaching a foreign key
-- that no longer resolves changes none of that: `actorId` becomes NULL because
-- the user row is gone, and every other column -- action, entityType,
-- entityId, metadata, ipAddress, createdAt -- is required to be byte-identical
-- for the update to be allowed at all. An UPDATE that alters anything the
-- entry asserts is still refused, and so is one that sets those two columns to
-- a DIFFERENT value rather than to NULL.
--
-- Deliberately not solved by making the FKs RESTRICT instead: that would mean a
-- user who has ever appeared in an audit entry can never be deleted, which
-- would make the account-deletion path impossible for every real account.

CREATE OR REPLACE FUNCTION "audit_log_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The only permitted update: a foreign key being detached to NULL by a
    -- referential action, with everything the entry asserts left untouched.
    IF NEW."id"             IS NOT DISTINCT FROM OLD."id"
       AND NEW."action"     IS NOT DISTINCT FROM OLD."action"
       AND NEW."entityType" IS NOT DISTINCT FROM OLD."entityType"
       AND NEW."entityId"   IS NOT DISTINCT FROM OLD."entityId"
       AND NEW."metadata"   IS NOT DISTINCT FROM OLD."metadata"
       AND NEW."ipAddress"  IS NOT DISTINCT FROM OLD."ipAddress"
       AND NEW."createdAt"  IS NOT DISTINCT FROM OLD."createdAt"
       AND (NEW."actorId"        IS NOT DISTINCT FROM OLD."actorId"        OR NEW."actorId"        IS NULL)
       AND (NEW."organizationId" IS NOT DISTINCT FROM OLD."organizationId" OR NEW."organizationId" IS NULL)
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION
    'AuditLog is append-only: % on audit records is not permitted.', TG_OP
    USING ERRCODE = 'check_violation',
          HINT = 'Audit history is evidence. Record a new entry instead of altering an existing one.';
END;
$$ LANGUAGE plpgsql;
