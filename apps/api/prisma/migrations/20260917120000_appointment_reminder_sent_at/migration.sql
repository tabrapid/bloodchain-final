-- Records when the "your appointment is coming up" reminder was sent.
--
-- Additive and nullable, so every appointment that already exists simply has
-- no reminder recorded and behaves exactly as before. Nothing is dropped,
-- altered or backfilled: a null here means "not reminded yet", which is the
-- truth for every row written before this column existed.
--
-- The column is the reminder job's idempotency claim. The job updates rows
-- conditionally on `reminderSentAt IS NULL`, so a repeated cron run, a restart
-- mid-batch, or two workers racing all end with one reminder per appointment.
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- The job's own query: due-soon appointments in a bookable status that have
-- not been reminded yet.
CREATE INDEX "Appointment_status_scheduledStart_reminderSentAt_idx"
  ON "Appointment"("status", "scheduledStart", "reminderSentAt");
