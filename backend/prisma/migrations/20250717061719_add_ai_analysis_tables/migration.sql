-- CreateTable
CREATE TABLE "root_cause_analyses" (
    "id" TEXT NOT NULL,
    "flakyTestPatternId" TEXT NOT NULL,
    "testResultId" TEXT,
    "primaryCategory" TEXT NOT NULL,
    "secondaryCategories" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "errorPattern" TEXT,
    "stackTraceSignature" TEXT,
    "timingIssues" TEXT[],
    "environmentFactors" TEXT[],
    "recommendations" JSONB NOT NULL,
    "estimatedFixEffort" TEXT,
    "similarIssuesCount" INTEGER NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "processingTime" INTEGER,
    "dataQuality" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "root_cause_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_contexts" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "ciRunner" TEXT,
    "ciRegion" TEXT,
    "nodeVersion" TEXT,
    "dependencies" JSONB,
    "executionTime" TIMESTAMP(3) NOT NULL,
    "timeOfDay" TEXT,
    "dayOfWeek" TEXT,
    "concurrentJobs" INTEGER,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskSpace" DOUBLE PRECISION,
    "networkLatency" INTEGER,
    "externalServices" JSONB,
    "databaseLoad" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environmental_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "environmental_contexts_testResultId_key" ON "environmental_contexts"("testResultId");

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_flakyTestPatternId_fkey" FOREIGN KEY ("flakyTestPatternId") REFERENCES "flaky_test_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "test_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_contexts" ADD CONSTRAINT "environmental_contexts_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "test_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
