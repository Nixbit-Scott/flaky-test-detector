-- CreateTable
CREATE TABLE "stability_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallStability" DOUBLE PRECISION NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "stableTests" INTEGER NOT NULL DEFAULT 0,
    "unstableTests" INTEGER NOT NULL DEFAULT 0,
    "criticalTests" INTEGER NOT NULL DEFAULT 0,
    "reportData" JSONB NOT NULL,
    "insights" TEXT[],
    "recommendations" TEXT[],
    "reportVersion" TEXT NOT NULL DEFAULT 'v1.0',

    CONSTRAINT "stability_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stability_reports" ADD CONSTRAINT "stability_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
