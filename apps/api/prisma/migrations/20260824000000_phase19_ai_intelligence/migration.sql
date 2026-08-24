-- Phase 19: AI Health Intelligence Platform
-- Add missing fields to AIInsight
ALTER TABLE "AIInsight" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "AIInsight" ADD COLUMN "model" TEXT;

-- Add promptVersion and requestFingerprint to AIRequestLog
ALTER TABLE "AIRequestLog" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "AIRequestLog" ADD COLUMN "requestFingerprint" TEXT;

-- Add promptVersion and model to AIInsightCache
ALTER TABLE "AIInsightCache" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "AIInsightCache" ADD COLUMN "model" TEXT;

-- Add indexes for new columns
CREATE INDEX "AIInsight_promptVersion_idx" ON "AIInsight"("promptVersion");
CREATE INDEX "AIInsight_model_idx" ON "AIInsight"("model");
CREATE INDEX "AIRequestLog_requestFingerprint_idx" ON "AIRequestLog"("requestFingerprint");
CREATE INDEX "AIRequestLog_promptVersion_idx" ON "AIRequestLog"("promptVersion");
CREATE INDEX "AIInsightCache_promptVersion_idx" ON "AIInsightCache"("promptVersion");

-- Add AIFeedbackType enum
CREATE TYPE "AIFeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'REPORT_ISSUE');

-- Create AIConversation table
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- Create AIMessage table
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "safetyLevel" "AISafetyLevel",
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- Create AIFeedback table
CREATE TABLE "AIFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "type" "AIFeedbackType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");
CREATE INDEX "AIConversation_expiresAt_idx" ON "AIConversation"("expiresAt");

CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

CREATE INDEX "AIFeedback_userId_idx" ON "AIFeedback"("userId");
CREATE INDEX "AIFeedback_insightId_idx" ON "AIFeedback"("insightId");
CREATE INDEX "AIFeedback_type_idx" ON "AIFeedback"("type");
CREATE INDEX "AIFeedback_createdAt_idx" ON "AIFeedback"("createdAt");

-- Add unique constraint on feedback per insight
CREATE UNIQUE INDEX "AIFeedback_insightId_key" ON "AIFeedback"("insightId");

-- Add foreign keys
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "AIInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
