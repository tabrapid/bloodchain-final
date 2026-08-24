-- Phase 20: Security Hardening
-- Add brute-force protection fields to User model
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP;

-- Create index for faster lockout checks
CREATE INDEX IF NOT EXISTS "User_lockoutUntil_idx" ON "User"("lockoutUntil");
CREATE INDEX IF NOT EXISTS "User_failedLoginAttempts_idx" ON "User"("failedLoginAttempts");

-- Add immutability trigger for AuditLog table (prevent update and delete)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are immutable. Update and delete operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_log_update ON "AuditLog";
CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_log_delete ON "AuditLog";
CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Add IdempotencyRecord table for idempotent critical operations
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "key"        VARCHAR(64) PRIMARY KEY,
  "result"     JSONB NOT NULL,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt"  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
