import { PrismaClient } from '@prisma/client';
import { StaticCodeAnalysisService, StaticCodeFeatures } from './static-code-analysis.service';
import { MLModelService } from './ml-model.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface PredictiveAnalysisResult {
  id: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  predictedFailureTypes: string[];
  estimatedTimeToFlaky?: number;
}

export interface MetadataFeatures {
  testFramework?: string;
  fileSize: number;
  fileAge?: number; // days since creation
  modificationFrequency?: number; // changes per month
  authorCount?: number;
  testCount: number;
  hasSetupTeardown: boolean;
  dependencyCount: number;
}

export class PredictiveAnalysisService {
  private staticAnalyzer: StaticCodeAnalysisService;
  private mlModel: MLModelService;

  constructor() {
    this.staticAnalyzer = new StaticCodeAnalysisService();
    this.mlModel = new MLModelService();
  }

  public async analyzeTestFile(
    projectId: string,
    filePath: string,
    fileContent: string,
    metadata?: Partial<MetadataFeatures>
  ): Promise<PredictiveAnalysisResult> {
    try {
      logger.info(`Starting predictive analysis for ${filePath}`);

      // Check if file is actually a test file
      if (!this.staticAnalyzer.isTestFile(filePath, fileContent)) {
        throw new Error('File does not appear to be a test file');
      }

      // Extract static code features
      const staticFeatures = await this.staticAnalyzer.analyzeTestFile(
        filePath,
        fileContent,
        this.getFileType(filePath)
      );

      // Extract metadata features
      const metadataFeatures = this.extractMetadataFeatures(fileContent, metadata);

      // Calculate risk score using ML model
      const mlPrediction = this.mlModel.predictRisk(staticFeatures, metadataFeatures);
      const riskAssessment = this.calculateRiskScore(staticFeatures, metadataFeatures, mlPrediction);

      // Predict failure types
      const predictedFailureTypes = this.predictFailureTypes(staticFeatures);

      // Store analysis in database
      const analysis = await this.storeAnalysis(
        projectId,
        filePath,
        riskAssessment,
        staticFeatures,
        metadataFeatures,
        predictedFailureTypes
      );

      logger.info(`Completed predictive analysis for ${filePath}: ${riskAssessment.riskLevel} risk`);

      return {
        id: analysis.id,
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        confidence: riskAssessment.confidence,
        predictedFailureTypes,
        estimatedTimeToFlaky: riskAssessment.estimatedTimeToFlaky
      };

    } catch (error) {
      logger.error(`Error in predictive analysis for ${filePath}:`, error);
      throw error;
    }
  }

  private getFileType(filePath: string): 'javascript' | 'typescript' {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript';
  }

  private extractMetadataFeatures(content: string, metadata?: Partial<MetadataFeatures>): MetadataFeatures {
    const testFramework = this.detectTestFramework(content);
    const testCount = this.countTests(content);
    const dependencyCount = this.countDependencies(content);
    const hasSetupTeardown = this.hasSetupTeardownMethods(content);

    return {
      testFramework,
      fileSize: content.length,
      fileAge: metadata?.fileAge,
      modificationFrequency: metadata?.modificationFrequency,
      authorCount: metadata?.authorCount,
      testCount,
      hasSetupTeardown,
      dependencyCount,
      ...metadata
    };
  }

  private detectTestFramework(content: string): string {
    if (/jest|@jest/i.test(content)) return 'jest';
    if (/mocha|@mocha/i.test(content)) return 'mocha';
    if (/cypress|cy\./i.test(content)) return 'cypress';
    if (/playwright|@playwright/i.test(content)) return 'playwright';
    if (/jasmine|@jasmine/i.test(content)) return 'jasmine';
    return 'unknown';
  }

  private countTests(content: string): number {
    const testPatterns = [
      /\bit\s*\(/g,
      /\btest\s*\(/g,
      /\bspec\s*\(/g
    ];

    return testPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private countDependencies(content: string): number {
    const importMatches = content.match(/import\s+.*from\s+['"][^'"]+['"]/g) || [];
    const requireMatches = content.match(/require\s*\(\s*['"][^'"]+['"]\s*\)/g) || [];
    return importMatches.length + requireMatches.length;
  }

  private hasSetupTeardownMethods(content: string): boolean {
    const setupTeardownPatterns = [
      /beforeEach\s*\(/,
      /beforeAll\s*\(/,
      /afterEach\s*\(/,
      /afterAll\s*\(/,
      /before\s*\(/,
      /after\s*\(/
    ];

    return setupTeardownPatterns.some(pattern => pattern.test(content));
  }

  private calculateRiskScore(
    staticFeatures: StaticCodeFeatures,
    metadataFeatures: MetadataFeatures,
    mlPrediction: { riskScore: number; confidence: number }
  ): {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    estimatedTimeToFlaky?: number;
  } {
    // Use ML model prediction as primary score with rule-based adjustments
    let riskScore = mlPrediction.riskScore;
    let confidence = mlPrediction.confidence;

    // Apply rule-based adjustments for edge cases
    const ruleBasedAdjustments = this.calculateRuleBasedAdjustments(staticFeatures, metadataFeatures);
    riskScore = Math.min(1.0, riskScore + ruleBasedAdjustments);

    // Adjust confidence based on data quality
    const dataQualityConfidence = this.calculateConfidence(staticFeatures, metadataFeatures);
    confidence = Math.min(confidence, dataQualityConfidence);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 0.8) riskLevel = 'critical';
    else if (riskScore >= 0.6) riskLevel = 'high';
    else if (riskScore >= 0.4) riskLevel = 'medium';
    else riskLevel = 'low';

    // Estimate time to flaky (if high risk)
    let estimatedTimeToFlaky: number | undefined;
    if (riskScore >= 0.6) {
      estimatedTimeToFlaky = Math.round(30 * (1 - riskScore)); // 0-30 days
    }

    return {
      riskScore: Math.round(riskScore * 100) / 100, // Round to 2 decimal places
      riskLevel,
      confidence: Math.round(confidence * 100) / 100,
      estimatedTimeToFlaky
    };
  }

  private calculateRuleBasedAdjustments(
    staticFeatures: StaticCodeFeatures,
    metadataFeatures: MetadataFeatures
  ): number {
    let adjustment = 0;

    // Critical patterns that should definitely increase risk
    if (staticFeatures.hardcodedDelays > 3) adjustment += 0.2;
    if (staticFeatures.raceConditionPatterns > 2) adjustment += 0.15;
    if (staticFeatures.timingSensitivity > 0.5) adjustment += 0.1;
    if (staticFeatures.testIsolationScore < 0.5) adjustment += 0.1;

    // E2E framework bonus risk
    if (metadataFeatures.testFramework === 'cypress' || metadataFeatures.testFramework === 'playwright') {
      adjustment += 0.05;
    }

    // Large file risk
    if ((metadataFeatures.fileSize || 0) > 10000) adjustment += 0.05;

    return Math.min(adjustment, 0.3); // Cap adjustments at 0.3
  }

  private calculateStaticRisk(features: StaticCodeFeatures): number {
    let risk = 0;

    // Complexity factors
    risk += Math.min(features.cyclomaticComplexity / 20, 0.3); // Max 0.3 for complexity
    risk += Math.min(features.nestingDepth / 10, 0.2); // Max 0.2 for nesting

    // Async and timing risks (highest weight)
    risk += Math.min(features.timingSensitivity * 2, 0.4); // Max 0.4 for timing
    risk += Math.min(features.hardcodedDelays / 5, 0.3); // Max 0.3 for hardcoded delays
    risk += Math.min(features.raceConditionPatterns / 3, 0.3); // Max 0.3 for race conditions

    // External dependency risks
    risk += Math.min(features.externalServiceCount / 10, 0.25); // Max 0.25 for external services
    risk += Math.min(features.resourceLeakRisk * 5, 0.2); // Max 0.2 for resource leaks

    // Test isolation risks
    risk += Math.min((1 - features.testIsolationScore) * 0.5, 0.25); // Max 0.25 for isolation issues

    return Math.min(risk, 1.0); // Cap at 1.0
  }

  private calculateMetadataRisk(features: MetadataFeatures): number {
    let risk = 0;

    // File size risk
    if (features.fileSize > 5000) risk += 0.2; // Large files are riskier
    if (features.fileSize > 10000) risk += 0.2;

    // Test count risk
    if (features.testCount > 50) risk += 0.15; // Too many tests in one file
    if (features.testCount === 0) risk += 0.3; // No tests found

    // Modification frequency risk
    if (features.modificationFrequency && features.modificationFrequency > 10) {
      risk += 0.2; // Frequently changed files
    }

    // Framework-specific risks
    if (features.testFramework === 'cypress' || features.testFramework === 'playwright') {
      risk += 0.1; // E2E tests are inherently more flaky
    }

    return Math.min(risk, 1.0);
  }

  private calculateStructureRisk(
    staticFeatures: StaticCodeFeatures,
    metadataFeatures: MetadataFeatures
  ): number {
    let risk = 0;

    // Setup/teardown complexity
    if (staticFeatures.setupTeardownComplexity > 5) risk += 0.3;

    // Shared state usage
    if (staticFeatures.sharedStateUsage > 3) risk += 0.4;

    // Missing setup/teardown for complex tests
    if (metadataFeatures.testCount > 10 && !metadataFeatures.hasSetupTeardown) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  private calculateConfidence(
    staticFeatures: StaticCodeFeatures,
    metadataFeatures: MetadataFeatures
  ): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence with more data
    if (metadataFeatures.fileAge !== undefined) confidence += 0.05;
    if (metadataFeatures.modificationFrequency !== undefined) confidence += 0.05;
    if (metadataFeatures.authorCount !== undefined) confidence += 0.05;

    // Lower confidence for edge cases
    if (staticFeatures.linesOfCode < 50) confidence -= 0.1; // Too small
    if (staticFeatures.linesOfCode > 2000) confidence -= 0.1; // Too large
    if (metadataFeatures.testCount === 0) confidence -= 0.2; // No tests found

    return Math.max(0.3, Math.min(1.0, confidence)); // Between 0.3 and 1.0
  }

  private predictFailureTypes(features: StaticCodeFeatures): string[] {
    const failureTypes: string[] = [];

    // Timing-related failures
    if (features.timingSensitivity > 0.1 || features.hardcodedDelays > 0) {
      failureTypes.push('timing_dependent');
    }

    // External service failures
    if (features.externalServiceCount > 2) {
      failureTypes.push('external_service');
    }

    // Resource-related failures
    if (features.resourceLeakRisk > 0.1) {
      failureTypes.push('resource_leak');
    }

    // Concurrency failures
    if (features.raceConditionPatterns > 1) {
      failureTypes.push('race_condition');
    }

    // Environment-related failures
    if (features.sharedStateUsage > 2 || features.testIsolationScore < 0.8) {
      failureTypes.push('environment_dependent');
    }

    // Data dependency failures
    if (features.databaseQueryCount > 3) {
      failureTypes.push('data_dependent');
    }

    // Network-related failures
    if (features.httpCallCount > 2) {
      failureTypes.push('network_dependent');
    }

    return failureTypes.length > 0 ? failureTypes : ['unknown'];
  }

  private async storeAnalysis(
    projectId: string,
    filePath: string,
    riskAssessment: any,
    staticFeatures: StaticCodeFeatures,
    metadataFeatures: MetadataFeatures,
    predictedFailureTypes: string[]
  ) {
    // Check if analysis already exists
    const existing = await prisma.predictiveAnalysis.findUnique({
      where: {
        projectId_testFilePath_testName: {
          projectId,
          testFilePath: filePath,
          testName: null as any
        }
      }
    });

    const analysisData = {
      projectId,
      testFilePath: filePath,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      confidence: riskAssessment.confidence,
      staticFeatures: staticFeatures as any,
      metadataFeatures: metadataFeatures as any,
      predictedFailureTypes,
      estimatedTimeToFlaky: riskAssessment.estimatedTimeToFlaky
    };

    if (existing) {
      // Update existing analysis
      return await prisma.predictiveAnalysis.update({
        where: { id: existing.id },
        data: analysisData
      });
    } else {
      // Create new analysis
      const analysis = await prisma.predictiveAnalysis.create({
        data: analysisData
      });

      // Create static features record
      await prisma.staticCodeFeatures.create({
        data: {
          predictiveAnalysisId: analysis.id,
          ...staticFeatures
        }
      });

      return analysis;
    }
  }

  public async getAnalysis(projectId: string, filePath: string): Promise<PredictiveAnalysisResult | null> {
    const analysis = await prisma.predictiveAnalysis.findUnique({
      where: {
        projectId_testFilePath_testName: {
          projectId,
          testFilePath: filePath,
          testName: null as any
        }
      }
    });

    if (!analysis) return null;

    return {
      id: analysis.id,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel as any,
      confidence: analysis.confidence,
      predictedFailureTypes: analysis.predictedFailureTypes,
      estimatedTimeToFlaky: analysis.estimatedTimeToFlaky || undefined
    };
  }

  public async getProjectRiskSummary(projectId: string): Promise<{
    totalFiles: number;
    highRiskFiles: number;
    averageRiskScore: number;
    riskDistribution: Record<string, number>;
  }> {
    const analyses = await prisma.predictiveAnalysis.findMany({
      where: { projectId }
    });

    const totalFiles = analyses.length;
    const highRiskFiles = analyses.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length;
    const averageRiskScore = analyses.reduce((sum, a) => sum + a.riskScore, 0) / Math.max(totalFiles, 1);

    const riskDistribution = analyses.reduce((dist, a) => {
      dist[a.riskLevel] = (dist[a.riskLevel] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    return {
      totalFiles,
      highRiskFiles,
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      riskDistribution
    };
  }
}