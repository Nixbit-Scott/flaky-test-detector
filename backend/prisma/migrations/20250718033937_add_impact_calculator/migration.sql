/*
  Warnings:

  - Added the required column `projectId` to the `test_results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "teamConfiguration" JSONB;

-- AlterTable
ALTER TABLE "test_results" ADD COLUMN     "projectId" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "impact_calculations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTimeWasted" DOUBLE PRECISION NOT NULL,
    "estimatedCostImpact" DOUBLE PRECISION NOT NULL,
    "deploymentsDelayed" INTEGER NOT NULL DEFAULT 0,
    "mergeRequestsBlocked" INTEGER NOT NULL DEFAULT 0,
    "velocityReduction" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "impactData" JSONB NOT NULL,
    "testImpacts" JSONB NOT NULL,
    "recommendations" TEXT[],
    "teamConfiguration" JSONB,
    "calculationVersion" TEXT NOT NULL DEFAULT 'v1.0',

    CONSTRAINT "impact_calculations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "impact_calculations" ADD CONSTRAINT "impact_calculations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
