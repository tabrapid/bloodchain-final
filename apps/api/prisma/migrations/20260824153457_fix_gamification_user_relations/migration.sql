-- DropForeignKey
ALTER TABLE "AchievementUnlock" DROP CONSTRAINT "AchievementUnlock_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReputationTransaction" DROP CONSTRAINT "ReputationTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "XpTransaction" DROP CONSTRAINT "XpTransaction_userId_fkey";

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationTransaction" ADD CONSTRAINT "ReputationTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
