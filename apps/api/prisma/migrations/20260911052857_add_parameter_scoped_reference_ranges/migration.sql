-- AlterTable
ALTER TABLE "TestReferenceRange" ADD COLUMN     "parameterId" TEXT;

-- CreateIndex
CREATE INDEX "TestReferenceRange_parameterId_idx" ON "TestReferenceRange"("parameterId");

-- AddForeignKey
ALTER TABLE "TestReferenceRange" ADD CONSTRAINT "TestReferenceRange_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
