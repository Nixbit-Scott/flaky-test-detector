-- CreateTable
CREATE TABLE "predictive_analyses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testFilePath" TEXT NOT NULL,
    "testName" TEXT,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "staticFeatures" JSONB NOT NULL,
    "metadataFeatures" JSONB NOT NULL,
    "predictedFailureTypes" TEXT[],
    "estimatedTimeToFlaky" INTEGER,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictive_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_code_features" (
    "id" TEXT NOT NULL,
    "predictiveAnalysisId" TEXT NOT NULL,
    "cyclomaticComplexity" INTEGER NOT NULL DEFAULT 0,
    "cognitiveComplexity" INTEGER NOT NULL DEFAULT 0,
    "nestingDepth" INTEGER NOT NULL DEFAULT 0,
    "linesOfCode" INTEGER NOT NULL DEFAULT 0,
    "asyncAwaitCount" INTEGER NOT NULL DEFAULT 0,
    "promiseChainCount" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "setIntervalCount" INTEGER NOT NULL DEFAULT 0,
    "httpCallCount" INTEGER NOT NULL DEFAULT 0,
    "fileSystemCount" INTEGER NOT NULL DEFAULT 0,
    "databaseQueryCount" INTEGER NOT NULL DEFAULT 0,
    "externalServiceCount" INTEGER NOT NULL DEFAULT 0,
    "setupTeardownComplexity" INTEGER NOT NULL DEFAULT 0,
    "sharedStateUsage" INTEGER NOT NULL DEFAULT 0,
    "testIsolationScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hardcodedDelays" INTEGER NOT NULL DEFAULT 0,
    "raceConditionPatterns" INTEGER NOT NULL DEFAULT 0,
    "timingSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "resourceLeakRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "static_code_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_feedback" (
    "id" TEXT NOT NULL,
    "predictiveAnalysisId" TEXT NOT NULL,
    "userId" TEXT,
    "actualOutcome" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "timeToOutcome" INTEGER,
    "userRating" INTEGER,
    "comments" TEXT,
    "wasHelpful" BOOLEAN,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_model_metrics" (
    "id" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1Score" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "auc" DOUBLE PRECISION NOT NULL,
    "trainingSize" INTEGER NOT NULL,
    "validationSize" INTEGER NOT NULL,
    "testSize" INTEGER NOT NULL,
    "topFeatures" JSONB NOT NULL,
    "algorithm" TEXT NOT NULL,
    "hyperparameters" JSONB NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ml_model_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "predictive_analyses_projectId_testFilePath_testName_key" ON "predictive_analyses"("projectId", "testFilePath", "testName");

-- CreateIndex
CREATE UNIQUE INDEX "static_code_features_predictiveAnalysisId_key" ON "static_code_features"("predictiveAnalysisId");

-- AddForeignKey
ALTER TABLE "predictive_analyses" ADD CONSTRAINT "predictive_analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_code_features" ADD CONSTRAINT "static_code_features_predictiveAnalysisId_fkey" FOREIGN KEY ("predictiveAnalysisId") REFERENCES "predictive_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_feedback" ADD CONSTRAINT "prediction_feedback_predictiveAnalysisId_fkey" FOREIGN KEY ("predictiveAnalysisId") REFERENCES "predictive_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
