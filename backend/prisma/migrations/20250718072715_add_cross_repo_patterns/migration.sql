-- CreateTable
CREATE TABLE "cross_repo_pattern_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedPatterns" JSONB NOT NULL,
    "patternCount" INTEGER NOT NULL DEFAULT 0,
    "analysisVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "timeWindowDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_repo_pattern_analyses_pkey" PRIMARY KEY ("id")
);
