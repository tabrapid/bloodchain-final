-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 43200,
    "aiHealthInsightsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sosEmergencyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
