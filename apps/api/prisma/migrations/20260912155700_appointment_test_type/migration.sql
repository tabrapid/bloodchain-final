-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "testTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "TestType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
