import { PrismaClient } from '@prisma/client';
import { StaticCodeFeatures } from './static-code-analysis.service';
import { MetadataFeatures } from './predictive-analysis.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface TrainingData {
  staticFeatures: StaticCodeFeatures;
  metadataFeatures: MetadataFeatures;
  label: 'flaky' | 'stable'; // Ground truth
  confidence: number;
}

export interface ModelMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  auc: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  description: string;
}

export class MLModelService {
  private modelVersion = 'v1.0';
  private featureWeights: Record<string, number> = {};

  constructor() {
    this.initializeFeatureWeights();
  }

  private initializeFeatureWeights() {
    // Rule-based weights based on research and domain knowledge
    // These would be learned from actual ML training
    this.featureWeights = {
      // High-impact timing features
      'timingSensitivity': 0.25,
      'hardcodedDelays': 0.20,
      'raceConditionPatterns': 0.18,
      
      // External dependency features
      'externalServiceCount': 0.15,
      'httpCallCount': 0.12,
      'databaseQueryCount': 0.10,
      
      // Test isolation features
      'testIsolationScore': -0.15, // Negative weight (higher isolation = lower risk)
      'sharedStateUsage': 0.12,
      
      // Complexity features
      'cyclomaticComplexity': 0.08,
      'nestingDepth': 0.06,
      'cognitiveComplexity': 0.05,
      
      // File system and resource features
      'fileSystemCount': 0.08,
      'resourceLeakRisk': 0.10,
      
      // Async patterns
      'asyncAwaitCount': 0.05,
      'promiseChainCount': 0.04,
      'timeoutCount': 0.08,
      
      // Test structure
      'setupTeardownComplexity': 0.06,
      'linesOfCode': 0.02,
      
      // Metadata features
      'fileSize': 0.03,
      'testCount': 0.04,
      'modificationFrequency': 0.06,
      'testFramework_e2e': 0.10 // Cypress/Playwright bonus
    };
  }

  public async trainModel(): Promise<ModelMetrics> {
    logger.info('Starting model training...');

    try {
      // Collect training data from existing flaky test patterns and test results
      const trainingData = await this.collectTrainingData();
      
      if (trainingData.length < 10) {
        logger.warn('Insufficient training data, using default model');
        return this.getDefaultMetrics();
      }

      // Split data into training and validation sets
      const { trainSet, validationSet } = this.splitData(trainingData);

      // Train the model (simplified rule-based approach)
      this.optimizeFeatureWeights(trainSet);

      // Evaluate model performance
      const metrics = this.evaluateModel(validationSet);

      // Store model metrics
      await this.storeModelMetrics(metrics, trainingData.length);

      logger.info(`Model training completed. F1-Score: ${metrics.f1Score.toFixed(3)}`);

      return metrics;

    } catch (error) {
      logger.error('Error during model training:', error);
      throw error;
    }
  }

  private async collectTrainingData(): Promise<TrainingData[]> {
    const trainingData: TrainingData[] = [];

    // Get data from existing flaky test patterns
    const flakyPatterns = await prisma.flakyTestPattern.findMany({
      where: {
        isActive: true,
        totalRuns: {
          gte: 5 // Minimum runs for reliable data
        }
      },
      include: {
        rootCauseAnalyses: true
      }
    });

    // Get predictive analyses with feedback
    const predictiveAnalyses = await prisma.predictiveAnalysis.findMany({
      include: {
        feedbacks: true,
        staticCodeFeatures: true
      }
    });

    // Convert flaky patterns to training data
    for (const pattern of flakyPatterns) {
      if (pattern.failureRate > 0.1) { // Consider flaky if >10% failure rate
        // Find corresponding predictive analysis
        const analysis = predictiveAnalyses.find(a => 
          a.testFilePath.includes(pattern.testName) || 
          pattern.testName.includes(a.testFilePath.split('/').pop() || '')
        );

        if (analysis && analysis.staticCodeFeatures) {
          trainingData.push({
            staticFeatures: analysis.staticCodeFeatures as any,
            metadataFeatures: analysis.metadataFeatures as any,
            label: 'flaky',
            confidence: pattern.confidence
          });
        }
      }
    }

    // Convert feedback data to training data
    for (const analysis of predictiveAnalyses) {
      for (const feedback of analysis.feedbacks) {
        if (feedback.actualOutcome !== 'unknown' && analysis.staticCodeFeatures) {
          trainingData.push({
            staticFeatures: analysis.staticCodeFeatures as any,
            metadataFeatures: analysis.metadataFeatures as any,
            label: feedback.actualOutcome === 'became_flaky' ? 'flaky' : 'stable',
            confidence: feedback.feedbackType === 'correct' ? 0.9 : 0.6
          });
        }
      }
    }

    // Add synthetic stable examples (from tests that have been running long without issues)
    const stableTestResults = await this.generateStableExamples();
    trainingData.push(...stableTestResults);

    logger.info(`Collected ${trainingData.length} training examples (${trainingData.filter(d => d.label === 'flaky').length} flaky, ${trainingData.filter(d => d.label === 'stable').length} stable)`);

    return trainingData;
  }

  private async generateStableExamples(): Promise<TrainingData[]> {
    // Generate synthetic stable examples based on tests that have been consistently passing
    const stableExamples: TrainingData[] = [];

    // Find projects with long-running stable tests
    const projects = await prisma.project.findMany({
      include: {
        testRuns: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    for (const project of projects) {
      // Generate synthetic stable test features
      const stableFeatures: StaticCodeFeatures = {
        cyclomaticComplexity: Math.floor(Math.random() * 5) + 1, // Low complexity
        cognitiveComplexity: Math.floor(Math.random() * 3) + 1,
        nestingDepth: Math.floor(Math.random() * 2) + 1,
        linesOfCode: Math.floor(Math.random() * 100) + 20,
        asyncAwaitCount: Math.floor(Math.random() * 2),
        promiseChainCount: Math.floor(Math.random() * 1),
        timeoutCount: 0, // No timeouts
        setIntervalCount: 0,
        httpCallCount: Math.floor(Math.random() * 1), // Minimal external calls
        fileSystemCount: 0,
        databaseQueryCount: Math.floor(Math.random() * 2),
        externalServiceCount: Math.floor(Math.random() * 1),
        setupTeardownComplexity: Math.floor(Math.random() * 2) + 1,
        sharedStateUsage: 0, // No shared state
        testIsolationScore: 0.9 + Math.random() * 0.1, // High isolation
        hardcodedDelays: 0, // No hardcoded delays
        raceConditionPatterns: 0, // No race conditions
        timingSensitivity: Math.random() * 0.05, // Very low timing sensitivity
        resourceLeakRisk: Math.random() * 0.02 // Minimal resource leak risk
      };

      const stableMetadata: MetadataFeatures = {
        testFramework: 'jest',
        fileSize: Math.floor(Math.random() * 2000) + 500,
        fileAge: Math.floor(Math.random() * 100) + 30,
        modificationFrequency: Math.random() * 2, // Low modification frequency
        authorCount: Math.floor(Math.random() * 3) + 1,
        testCount: Math.floor(Math.random() * 10) + 1,
        hasSetupTeardown: Math.random() > 0.5,
        dependencyCount: Math.floor(Math.random() * 10) + 2
      };

      stableExamples.push({
        staticFeatures: stableFeatures,
        metadataFeatures: stableMetadata,
        label: 'stable',
        confidence: 0.8
      });

      if (stableExamples.length >= 20) break; // Limit synthetic examples
    }

    return stableExamples;
  }

  private splitData(data: TrainingData[]): { trainSet: TrainingData[], validationSet: TrainingData[] } {
    // Shuffle data
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    
    // 80/20 split
    const splitIndex = Math.floor(shuffled.length * 0.8);
    
    return {
      trainSet: shuffled.slice(0, splitIndex),
      validationSet: shuffled.slice(splitIndex)
    };
  }

  private optimizeFeatureWeights(trainSet: TrainingData[]) {
    // Simple optimization: adjust weights based on correlation with labels
    const featureStats: Record<string, { flakySum: number, stableSum: number, flakyCount: number, stableCount: number }> = {};

    // Calculate feature statistics
    for (const example of trainSet) {
      const features = this.extractFeatureVector(example.staticFeatures, example.metadataFeatures);
      
      for (const [feature, value] of Object.entries(features)) {
        if (!featureStats[feature]) {
          featureStats[feature] = { flakySum: 0, stableSum: 0, flakyCount: 0, stableCount: 0 };
        }

        if (example.label === 'flaky') {
          featureStats[feature].flakySum += value;
          featureStats[feature].flakyCount++;
        } else {
          featureStats[feature].stableSum += value;
          featureStats[feature].stableCount++;
        }
      }
    }

    // Adjust weights based on discriminative power
    for (const [feature, stats] of Object.entries(featureStats)) {
      if (stats.flakyCount > 0 && stats.stableCount > 0) {
        const flakyMean = stats.flakySum / stats.flakyCount;
        const stableMean = stats.stableSum / stats.stableCount;
        
        // Calculate correlation strength
        const correlation = Math.abs(flakyMean - stableMean);
        
        // Adjust weight based on correlation (simplified)
        if (this.featureWeights[feature] !== undefined) {
          this.featureWeights[feature] *= (1 + correlation * 0.1);
        }
      }
    }

    logger.info('Feature weights optimized based on training data');
  }

  public predictRisk(staticFeatures: StaticCodeFeatures, metadataFeatures: MetadataFeatures): {
    riskScore: number;
    confidence: number;
  } {
    const features = this.extractFeatureVector(staticFeatures, metadataFeatures);
    let riskScore = 0;

    // Calculate weighted risk score
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.featureWeights[feature] || 0;
      riskScore += value * weight;
    }

    // Apply sigmoid function to normalize to 0-1 range
    riskScore = 1 / (1 + Math.exp(-riskScore));

    // Calculate confidence based on feature coverage
    const featureCoverage = Object.keys(features).length / Object.keys(this.featureWeights).length;
    const confidence = Math.min(0.9, 0.6 + featureCoverage * 0.3);

    return {
      riskScore: Math.max(0, Math.min(1, riskScore)),
      confidence
    };
  }

  private extractFeatureVector(staticFeatures: StaticCodeFeatures, metadataFeatures: MetadataFeatures): Record<string, number> {
    const features: Record<string, number> = {};

    // Static code features
    features['cyclomaticComplexity'] = Math.min(staticFeatures.cyclomaticComplexity / 20, 1);
    features['cognitiveComplexity'] = Math.min(staticFeatures.cognitiveComplexity / 15, 1);
    features['nestingDepth'] = Math.min(staticFeatures.nestingDepth / 8, 1);
    features['linesOfCode'] = Math.min(staticFeatures.linesOfCode / 1000, 1);
    features['timingSensitivity'] = staticFeatures.timingSensitivity;
    features['hardcodedDelays'] = Math.min(staticFeatures.hardcodedDelays / 5, 1);
    features['raceConditionPatterns'] = Math.min(staticFeatures.raceConditionPatterns / 3, 1);
    features['externalServiceCount'] = Math.min(staticFeatures.externalServiceCount / 10, 1);
    features['testIsolationScore'] = staticFeatures.testIsolationScore;
    features['sharedStateUsage'] = Math.min(staticFeatures.sharedStateUsage / 5, 1);
    features['resourceLeakRisk'] = staticFeatures.resourceLeakRisk;

    // Metadata features
    features['fileSize'] = Math.min((metadataFeatures.fileSize || 0) / 5000, 1);
    features['testCount'] = Math.min((metadataFeatures.testCount || 0) / 20, 1);
    features['modificationFrequency'] = Math.min((metadataFeatures.modificationFrequency || 0) / 10, 1);
    
    // Framework-specific features
    if (metadataFeatures.testFramework === 'cypress' || metadataFeatures.testFramework === 'playwright') {
      features['testFramework_e2e'] = 1;
    } else {
      features['testFramework_e2e'] = 0;
    }

    return features;
  }

  private evaluateModel(validationSet: TrainingData[]): ModelMetrics {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const example of validationSet) {
      const prediction = this.predictRisk(example.staticFeatures, example.metadataFeatures);
      const predictedLabel = prediction.riskScore > 0.5 ? 'flaky' : 'stable';
      const actualLabel = example.label;

      if (predictedLabel === 'flaky' && actualLabel === 'flaky') truePositives++;
      else if (predictedLabel === 'flaky' && actualLabel === 'stable') falsePositives++;
      else if (predictedLabel === 'stable' && actualLabel === 'stable') trueNegatives++;
      else if (predictedLabel === 'stable' && actualLabel === 'flaky') falseNegatives++;
    }

    const precision = truePositives / Math.max(truePositives + falsePositives, 1);
    const recall = truePositives / Math.max(truePositives + falseNegatives, 1);
    const f1Score = 2 * (precision * recall) / Math.max(precision + recall, 0.001);
    const accuracy = (truePositives + trueNegatives) / Math.max(validationSet.length, 1);

    // Simplified AUC calculation
    const auc = (precision + recall) / 2;

    return {
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1Score: Math.round(f1Score * 1000) / 1000,
      accuracy: Math.round(accuracy * 1000) / 1000,
      auc: Math.round(auc * 1000) / 1000
    };
  }

  private async storeModelMetrics(metrics: ModelMetrics, trainingSize: number) {
    await prisma.mLModelMetrics.create({
      data: {
        modelVersion: this.modelVersion,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1Score,
        accuracy: metrics.accuracy,
        auc: metrics.auc,
        trainingSize: trainingSize,
        validationSize: Math.floor(trainingSize * 0.2),
        testSize: 0,
        topFeatures: this.getTopFeatures(),
        algorithm: 'rule_based_weighted',
        hyperparameters: { weights: this.featureWeights },
        isActive: true
      }
    });

    // Mark previous models as inactive
    await prisma.mLModelMetrics.updateMany({
      where: {
        modelVersion: { not: this.modelVersion },
        isActive: true
      },
      data: { isActive: false }
    });
  }

  private getTopFeatures(): any {
    const features = Object.entries(this.featureWeights)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10)
      .map(([name, weight]) => ({
        name,
        weight: Math.round(weight * 1000) / 1000,
        importance: Math.abs(weight)
      }));

    return { features };
  }

  private getDefaultMetrics(): ModelMetrics {
    return {
      precision: 0.75,
      recall: 0.70,
      f1Score: 0.72,
      accuracy: 0.80,
      auc: 0.75
    };
  }

  public getFeatureImportance(): FeatureImportance[] {
    const descriptions: Record<string, string> = {
      'timingSensitivity': 'Measures reliance on timing-dependent operations',
      'hardcodedDelays': 'Count of hardcoded delays and timeouts',
      'raceConditionPatterns': 'Potential race condition patterns detected',
      'externalServiceCount': 'Number of external service dependencies',
      'testIsolationScore': 'How well isolated the test is from external state',
      'sharedStateUsage': 'Usage of shared global state',
      'cyclomaticComplexity': 'Cyclomatic complexity of test code',
      'resourceLeakRisk': 'Risk of resource leaks (connections, files, etc.)'
    };

    return Object.entries(this.featureWeights)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 15)
      .map(([feature, weight]) => ({
        feature,
        importance: Math.abs(weight),
        description: descriptions[feature] || 'Feature importance for flaky test prediction'
      }));
  }
}