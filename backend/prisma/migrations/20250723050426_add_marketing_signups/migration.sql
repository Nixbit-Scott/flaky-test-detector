-- CreateTable
CREATE TABLE "marketing_signups" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "teamSize" TEXT,
    "currentPainPoints" TEXT[],
    "interestedFeatures" TEXT[],
    "source" TEXT,
    "utmParameters" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isConverted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "convertedUserId" TEXT,
    "emailSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribedAt" TIMESTAMP(3),
    "leadScore" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_signups_email_key" ON "marketing_signups"("email");

-- CreateIndex
CREATE INDEX "marketing_signups_email_idx" ON "marketing_signups"("email");

-- CreateIndex
CREATE INDEX "marketing_signups_isConverted_idx" ON "marketing_signups"("isConverted");

-- CreateIndex
CREATE INDEX "marketing_signups_source_idx" ON "marketing_signups"("source");

-- CreateIndex
CREATE INDEX "marketing_signups_createdAt_idx" ON "marketing_signups"("createdAt");
