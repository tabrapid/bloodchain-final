-- Rejection is the fulfilling blood centre declining a request. It is a
-- different act from the requesting hospital cancelling one, and it had
-- nowhere to be recorded: the only way to refuse a request was to "approve"
-- it with zero units on every item, which set REJECTED as a side effect and
-- left no reason, no actor and no timestamp behind.
ALTER TABLE "BloodRequest" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
