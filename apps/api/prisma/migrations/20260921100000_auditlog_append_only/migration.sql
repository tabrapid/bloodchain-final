-- Make AuditLog append-only in the database, because the documentation already
-- said it was.
--
-- docs/security.md has claimed since it was written that "AuditLog immutability
-- via database triggers" was in place, that a "Database trigger prevents UPDATE
-- on AuditLog", and the same for DELETE. None of it existed. There was no
-- trigger in any of the eighteen migrations, no Prisma middleware, and no
-- revoked privilege -- the audit trail was an ordinary table that any code with
-- a database connection could rewrite. A security control that exists only in a
-- document is worse than a missing one, because it is relied upon.
--
-- What this does and does not claim:
--
--   * INSERT is unaffected. The table is append-only, not read-only.
--   * UPDATE and DELETE raise an exception, for every role including the
--     application's and including a superuser. Row-level triggers are not
--     bypassed by privilege.
--   * TRUNCATE is deliberately NOT blocked. Postgres fires statement-level
--     TRUNCATE triggers, not row-level DELETE triggers, so `prisma/seed.ts`
--     keeps working -- and that matters, because the seed's TRUNCATE is how a
--     developer resets a local database and is already guarded by
--     `checkLocalDatabase` against running anywhere that is not one.
--   * This is NOT cryptographic immutability. There is no hash chain and no
--     signature; someone with SQL privileges can drop the trigger. What it
--     stops is the application, an ORM call, a migration script or a careless
--     hand at a psql prompt silently rewriting history -- which is the threat
--     the claim in the documentation was about.
--
-- No retention period is implied or enforced here. When a retention rule
-- exists it will need an explicit, audited mechanism of its own; it does not
-- get one by leaving the door open.

CREATE OR REPLACE FUNCTION "audit_log_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'AuditLog is append-only: % on audit records is not permitted.', TG_OP
    USING ERRCODE = 'check_violation',
          HINT = 'Audit history is evidence. Record a new entry instead of altering an existing one.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_log_no_update" ON "AuditLog";
CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

DROP TRIGGER IF EXISTS "audit_log_no_delete" ON "AuditLog";
CREATE TRIGGER "audit_log_no_delete"
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();
