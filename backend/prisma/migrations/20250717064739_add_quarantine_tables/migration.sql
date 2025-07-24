-- AlterTable
ALTER TABLE "flaky_test_patterns" ADD COLUMN     "isQuarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quarantineReason" TEXT,
ADD COLUMN     "quarantinedAt" TIMESTAMP(3),
ADD COLUMN     "quarantinedBy" TEXT;

-- CreateTable
CREATE TABLE "quarantine_history" (
    "id" TEXT NOT NULL,
    "flakyTestPatternId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "failureRate" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "consecutiveFailures" INTEGER,
    "impactScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarantine_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantine_policies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 3,
    "minRunsRequired" INTEGER NOT NULL DEFAULT 5,
    "stabilityPeriod" INTEGER NOT NULL DEFAULT 7,
    "successRateRequired" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "minSuccessfulRuns" INTEGER NOT NULL DEFAULT 10,
    "highImpactSuites" TEXT[],
    "priorityTests" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantine_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantine_impacts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "flakyTestPatternId" TEXT NOT NULL,
    "buildsBlocked" INTEGER NOT NULL DEFAULT 0,
    "ciTimeWasted" INTEGER NOT NULL DEFAULT 0,
    "developerHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "falsePositives" INTEGER NOT NULL DEFAULT 0,
    "quarantinePeriod" INTEGER NOT NULL DEFAULT 0,
    "autoUnquarantined" BOOLEAN NOT NULL DEFAULT false,
    "manualIntervention" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantine_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quarantine_impacts_projectId_flakyTestPatternId_key" ON "quarantine_impacts"("projectId", "flakyTestPatternId");

-- AddForeignKey
ALTER TABLE "quarantine_history" ADD CONSTRAINT "quarantine_history_flakyTestPatternId_fkey" FOREIGN KEY ("flakyTestPatternId") REFERENCES "flaky_test_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantine_policies" ADD CONSTRAINT "quarantine_policies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantine_impacts" ADD CONSTRAINT "quarantine_impacts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantine_impacts" ADD CONSTRAINT "quarantine_impacts_flakyTestPatternId_fkey" FOREIGN KEY ("flakyTestPatternId") REFERENCES "flaky_test_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
