-- XpTransaction's uniqueness was (sourceType, sourceId), which is only correct
-- when sourceId is per-user. It is not for ACHIEVEMENT (an achievement code),
-- CHALLENGE (a challenge id) or EDUCATION (a content id): those identify a
-- platform-wide milestone, so the first donor to reach one claimed the XP and
-- every donor after them was silently refused it.
--
-- Adding userId to the key strictly weakens it, so no existing row can conflict.
DROP INDEX "XpTransaction_sourceType_sourceId_key";

CREATE UNIQUE INDEX "XpTransaction_userId_sourceType_sourceId_key" ON "XpTransaction"("userId", "sourceType", "sourceId");
