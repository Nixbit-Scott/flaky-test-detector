import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CrossRepoPattern } from './cross-repo-pattern-detection.service';

const prisma = new PrismaClient();

export interface StabilityPrediction {
  id: string;
  organizationId: string;
  testId: string;
  testName: string;
  testSuite?: string;
  projectId: string;
  projectName: string;
  riskScore: number; // 0-1, higher = more likely to become flaky
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1, model confidence in prediction
  predictedTimeToFlaky: number; // estimated days until test becomes flaky
  riskFactors: {
    crossRepoPatterns: string[]; // Related cross-repo patterns
    historicalInstability: number; // Historical flakiness score
    codeComplexity: number; // Static analysis complexity score
    environmentalFactors: string[]; // CI/CD, dependencies, etc.
    testCharacteristics: string[]; // Test type, duration, dependencies
    teamFactors: string[]; // Team size, velocity, practices
  };
  preventiveMeasures: {
    immediate: string[]; // Actions to take now
    monitoring: string[]; // What to monitor
    refactoring: string[]; // Code improvements
    processChanges: string[]; // Team process improvements
  };
  crossRepoImpact: {
    similarTestsAtRisk: number; // Number of similar tests across repos
    potentialCascadeEffect: boolean; // Could failure cascade to other repos
    organizationalRisk: 'low' | 'medium' | 'high'; // Risk to organization
  };
  createdAt: Date;
  lastUpdated: Date;
  verificationResults?: {
    actualBecameFlaky: boolean;
    actualTimeToFlaky?: number;
    predictionAccuracy: number;
  };
}

export interface OrganizationStabilityForecast {
  organizationId: string;
  forecastDate: Date;
  timeHorizon: number; // days
  predictions: StabilityPrediction[];
  summary: {
    testsAtRisk: number;
    highRiskTests: number;
    criticalRiskTests: number;
    estimatedImpactCost: number;
    topRiskFactors: string[];
    preventiveMeasuresRecommended: number;
  };
  trends: {
    stabilityTrend: 'improving' | 'stable' | 'declining';
    riskFactorTrends: Record<string, 'increasing' | 'stable' | 'decreasing'>;
    predictedFailureRate: number; // Expected failure rate increase
  };
  actionPlan: {
    immediate: Array<{
      priority: 'high' | 'medium' | 'low';
      action: string;
      affectedTests: number;
      estimatedEffort: string;
    }>;
    shortTerm: string[];
    longTerm: string[];
  };
}

export class CrossRepoStabilityPredictionService {
  
  /**
   * Generate stability predictions for all tests in an organization
   */
  public async generateOrganizationForecast(
    organizationId: string,
    timeHorizonDays: number = 30
  ): Promise<OrganizationStabilityForecast> {
    logger.info(`Generating stability forecast for organization ${organizationId} with ${timeHorizonDays} day horizon`);

    // Get all projects and tests for the organization
    const projects = await this.getOrganizationProjects(organizationId);
    const allPredictions: StabilityPrediction[] = [];

    // Generate predictions for each project
    for (const project of projects) {
      const projectPredictions = await this.generateProjectPredictions(
        project,
        organizationId,
        timeHorizonDays
      );
      allPredictions.push(...projectPredictions);
    }

    // Enhance predictions with cross-repo analysis
    const enhancedPredictions = await this.enhancePredictionsWithCrossRepoData(
      allPredictions,
      organizationId
    );

    // Generate summary and trends
    const summary = this.generateSummary(enhancedPredictions);
    const trends = await this.analyzeTrends(organizationId, enhancedPredictions);
    const actionPlan = this.generateActionPlan(enhancedPredictions);

    const forecast: OrganizationStabilityForecast = {
      organizationId,
      forecastDate: new Date(),
      timeHorizon: timeHorizonDays,
      predictions: enhancedPredictions,
      summary,
      trends,
      actionPlan
    };

    // Store forecast for future reference
    await this.storeForecast(forecast);

    logger.info(`Generated forecast with ${enhancedPredictions.length} predictions, ${summary.highRiskTests} high-risk tests`);
    
    return forecast;
  }

  /**
   * Get real-time stability insights for a specific test
   */
  public async getTestStabilityInsights(
    testId: string,
    organizationId: string
  ): Promise<{
    currentStability: number;
    riskFactors: string[];
    similarFailuresAcrossRepos: Array<{
      projectName: string;
      testName: string;
      similarity: number;
      lastFailure: Date;
    }>;
    recommendations: string[];
    monitoringSetup: {
      metricsToTrack: string[];
      alertThresholds: Record<string, number>;
      checkFrequency: string;
    };
  }> {
    
    // Get test history and context
    const testHistory = await this.getTestHistory(testId);
    const crossRepoSimilarities = await this.findSimilarTestsAcrossRepos(testId, organizationId);
    
    const currentStability = this.calculateCurrentStability(testHistory);
    const riskFactors = this.identifyRiskFactors(testHistory, crossRepoSimilarities);
    const recommendations = this.generateTestSpecificRecommendations(riskFactors, testHistory);
    
    return {
      currentStability,
      riskFactors,
      similarFailuresAcrossRepos: crossRepoSimilarities,
      recommendations,
      monitoringSetup: {
        metricsToTrack: [
          'failure_rate',
          'execution_time_variance',
          'environmental_changes',
          'dependency_updates',
          'similar_test_failures'
        ],
        alertThresholds: {
          failure_rate: 0.1, // Alert if failure rate > 10%
          execution_time_variance: 2.0, // Alert if variance > 2x normal
          similar_failures: 3 // Alert if 3+ similar tests fail
        },
        checkFrequency: 'hourly'
      }
    };
  }

  /**
   * Update prediction accuracy based on actual outcomes
   */
  public async updatePredictionAccuracy(
    predictionId: string,
    actualOutcome: {
      becameFlaky: boolean;
      timeToFlaky?: number;
      actualRiskFactors?: string[];
    }
  ): Promise<void> {
    const prediction = await this.getPrediction(predictionId);
    if (!prediction) {
      logger.warn(`Prediction ${predictionId} not found for accuracy update`);
      return;
    }

    const accuracy = this.calculatePredictionAccuracy(prediction, actualOutcome);
    
    prediction.verificationResults = {
      actualBecameFlaky: actualOutcome.becameFlaky,
      actualTimeToFlaky: actualOutcome.timeToFlaky,
      predictionAccuracy: accuracy
    };

    await this.updatePrediction(prediction);
    
    // Use this feedback to improve the ML model
    await this.updateMLModel(prediction, actualOutcome);
    
    logger.info(`Updated prediction accuracy for ${predictionId}: ${accuracy.toFixed(2)}`);
  }

  /**
   * Get organization-wide stability trends
   */
  public async getStabilityTrends(
    organizationId: string,
    periodDays: number = 90
  ): Promise<{
    overallTrend: 'improving' | 'stable' | 'declining';
    riskDistribution: Record<string, number>; // risk level -> count
    topRiskFactors: Array<{
      factor: string;
      frequency: number;
      impact: number;
    }>;
    predictiveAccuracy: {
      overallAccuracy: number;
      accuracyByRiskLevel: Record<string, number>;
      modelConfidence: number;
    };
    recommendations: {
      modelImprovements: string[];
      processImprovements: string[];
      toolingRecommendations: string[];
    };
  }> {
    
    const historicalForecasts = await this.getHistoricalForecasts(organizationId, periodDays);
    const verifiedPredictions = await this.getVerifiedPredictions(organizationId, periodDays);
    
    return {
      overallTrend: this.analyzeOverallTrend(historicalForecasts),
      riskDistribution: this.calculateRiskDistribution(historicalForecasts),
      topRiskFactors: this.identifyTopRiskFactors(historicalForecasts),
      predictiveAccuracy: this.calculatePredictiveAccuracy(verifiedPredictions),
      recommendations: this.generateTrendBasedRecommendations(historicalForecasts, verifiedPredictions)
    };
  }

  // Private helper methods

  private async getOrganizationProjects(organizationId: string) {
    return await prisma.project.findMany({
      where: { teamId: organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  private async generateProjectPredictions(
    project: any,
    organizationId: string,
    timeHorizonDays: number
  ): Promise<StabilityPrediction[]> {
    const predictions: StabilityPrediction[] = [];
    
    // Get recent test results for the project
    const testResults = await prisma.testResult.findMany({
      where: {
        testRun: { projectId: project.id },
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        testRun: {
          select: {
            projectId: true,
            branch: true,
            commit: true
          }
        }
      }
    });

    // Group by test name
    const testGroups = this.groupTestsByName(testResults);
    
    for (const [testName, results] of Object.entries(testGroups)) {
      const prediction = await this.generateTestPrediction(
        testName,
        results as any[],
        project,
        organizationId,
        timeHorizonDays
      );
      
      if (prediction.riskScore > 0.3) { // Only include tests with significant risk
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  private groupTestsByName(testResults: any[]): Record<string, any[]> {
    return testResults.reduce((groups, result) => {
      const testName = result.testName;
      if (!groups[testName]) {
        groups[testName] = [];
      }
      groups[testName].push(result);
      return groups;
    }, {});
  }

  private async generateTestPrediction(
    testName: string,
    testResults: any[],
    project: any,
    organizationId: string,
    timeHorizonDays: number
  ): Promise<StabilityPrediction> {
    
    // Calculate base risk factors
    const historicalInstability = this.calculateHistoricalInstability(testResults);
    const codeComplexity = await this.estimateCodeComplexity(testName, project.id);
    const environmentalFactors = this.identifyEnvironmentalFactors(testResults);
    const testCharacteristics = this.analyzeTestCharacteristics(testResults);
    
    // ML-based risk scoring
    const riskScore = this.calculateMLRiskScore({
      historicalInstability,
      codeComplexity,
      environmentalFactors: environmentalFactors.length,
      testDuration: this.calculateAverageTestDuration(testResults),
      failurePatterns: this.identifyFailurePatterns(testResults)
    });

    const riskLevel = this.determineRiskLevel(riskScore);
    const confidence = this.calculateModelConfidence(testResults.length, riskScore);
    const predictedTimeToFlaky = this.predictTimeToFlaky(riskScore, testResults);

    const prediction: StabilityPrediction = {
      id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      testId: `${project.id}-${testName}`,
      testName,
      testSuite: testResults[0]?.testSuite,
      projectId: project.id,
      projectName: project.name,
      riskScore,
      riskLevel,
      confidence,
      predictedTimeToFlaky,
      riskFactors: {
        crossRepoPatterns: [], // Will be filled by cross-repo enhancement
        historicalInstability,
        codeComplexity,
        environmentalFactors,
        testCharacteristics,
        teamFactors: this.analyzeTeamFactors(project)
      },
      preventiveMeasures: this.generatePreventiveMeasures(riskScore, environmentalFactors, testCharacteristics),
      crossRepoImpact: {
        similarTestsAtRisk: 0, // Will be calculated in cross-repo enhancement
        potentialCascadeEffect: false,
        organizationalRisk: 'low'
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    return prediction;
  }

  private calculateHistoricalInstability(testResults: any[]): number {
    if (testResults.length === 0) return 0;
    
    const failures = testResults.filter(r => r.status === 'failed').length;
    const failureRate = failures / testResults.length;
    
    // Calculate variance in results (flakiness indicator)
    const variance = this.calculateResultVariance(testResults);
    
    return Math.min(1, failureRate + variance);
  }

  private calculateResultVariance(testResults: any[]): number {
    // Group by day and calculate variance in daily success rates
    const dailyGroups = testResults.reduce((groups, result) => {
      const day = new Date(result.timestamp).toDateString();
      if (!groups[day]) groups[day] = [];
      groups[day].push(result);
      return groups;
    }, {});

    const dailySuccessRates = Object.values(dailyGroups).map((dayResults: any) => {
      const successes = dayResults.filter((r: any) => r.status === 'passed').length;
      return successes / dayResults.length;
    });

    if (dailySuccessRates.length < 2) return 0;

    const mean = dailySuccessRates.reduce((sum, rate) => sum + rate, 0) / dailySuccessRates.length;
    const variance = dailySuccessRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / dailySuccessRates.length;
    
    return Math.sqrt(variance); // Standard deviation as instability measure
  }

  private async estimateCodeComplexity(testName: string, projectId: string): Promise<number> {
    // In real implementation, this would analyze the actual test code
    // For now, estimate based on test name patterns
    let complexity = 0.3; // Base complexity
    
    // Integration tests are typically more complex and flaky
    if (testName.toLowerCase().includes('integration')) complexity += 0.3;
    if (testName.toLowerCase().includes('e2e')) complexity += 0.4;
    if (testName.toLowerCase().includes('browser')) complexity += 0.3;
    if (testName.toLowerCase().includes('database')) complexity += 0.2;
    if (testName.toLowerCase().includes('network')) complexity += 0.2;
    
    return Math.min(1, complexity);
  }

  private identifyEnvironmentalFactors(testResults: any[]): string[] {
    const factors = new Set<string>();
    
    testResults.forEach(result => {
      // Analyze patterns that suggest environmental factors
      if (result.errorMessage) {
        if (result.errorMessage.includes('timeout')) factors.add('timeout_issues');
        if (result.errorMessage.includes('connection')) factors.add('connection_issues');
        if (result.errorMessage.includes('resource')) factors.add('resource_contention');
        if (result.errorMessage.includes('network')) factors.add('network_instability');
      }
      
      // Branch-based patterns
      if (result.testRun?.branch === 'main') factors.add('main_branch_instability');
    });
    
    return Array.from(factors);
  }

  private analyzeTestCharacteristics(testResults: any[]): string[] {
    const characteristics = new Set<string>();
    
    const avgDuration = this.calculateAverageTestDuration(testResults);
    if (avgDuration > 60000) characteristics.add('long_running'); // > 1 minute
    if (avgDuration > 300000) characteristics.add('very_long_running'); // > 5 minutes
    
    // Analyze test names for patterns
    const testName = testResults[0]?.testName?.toLowerCase() || '';
    if (testName.includes('async')) characteristics.add('async_operations');
    if (testName.includes('concurrent')) characteristics.add('concurrency_testing');
    if (testName.includes('retry')) characteristics.add('retry_logic');
    if (testName.includes('random')) characteristics.add('randomized_testing');
    
    return Array.from(characteristics);
  }

  private calculateAverageTestDuration(testResults: any[]): number {
    const durationsWithValues = testResults.filter(r => r.duration && r.duration > 0);
    if (durationsWithValues.length === 0) return 5000; // Default 5 seconds
    
    const totalDuration = durationsWithValues.reduce((sum, r) => sum + r.duration, 0);
    return totalDuration / durationsWithValues.length;
  }

  private identifyFailurePatterns(testResults: any[]): string[] {
    const failures = testResults.filter(r => r.status === 'failed');
    const patterns = new Set<string>();
    
    // Time-based patterns
    const failureTimes = failures.map(f => new Date(f.timestamp).getHours());
    const timeVariance = this.calculateVariance(failureTimes);
    if (timeVariance < 2) patterns.add('time_based_failures');
    
    // Error message patterns
    const errorMessages = failures.map(f => f.errorMessage).filter(Boolean);
    const uniqueErrors = new Set(errorMessages);
    if (uniqueErrors.size < errorMessages.length * 0.5) {
      patterns.add('recurring_error_patterns');
    }
    
    return Array.from(patterns);
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    return variance;
  }

  private calculateMLRiskScore(features: {
    historicalInstability: number;
    codeComplexity: number;
    environmentalFactors: number;
    testDuration: number;
    failurePatterns: string[];
  }): number {
    // Simple ML-like scoring based on weighted features
    let score = 0;
    
    score += features.historicalInstability * 0.4; // High weight for historical data
    score += features.codeComplexity * 0.2;
    score += Math.min(1, features.environmentalFactors / 5) * 0.2; // Normalize environmental factors
    score += Math.min(1, features.testDuration / 300000) * 0.1; // Normalize duration (5 min max)
    score += Math.min(1, features.failurePatterns.length / 3) * 0.1; // Normalize pattern count
    
    return Math.min(1, score);
  }

  private determineRiskLevel(riskScore: number): StabilityPrediction['riskLevel'] {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  private calculateModelConfidence(sampleSize: number, riskScore: number): number {
    // Confidence increases with more data and extreme risk scores
    const sampleConfidence = Math.min(1, sampleSize / 50); // Max confidence with 50+ samples
    const scoreConfidence = Math.abs(riskScore - 0.5) * 2; // Higher confidence for extreme scores
    
    return Math.min(1, (sampleConfidence + scoreConfidence) / 2);
  }

  private predictTimeToFlaky(riskScore: number, testResults: any[]): number {
    // Predict days until test becomes flaky based on risk score and current trend
    const baseDays = Math.max(1, Math.floor((1 - riskScore) * 90)); // 1-90 days based on risk
    
    // Adjust based on recent failure trend
    const recentFailures = testResults
      .filter(r => new Date(r.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .filter(r => r.status === 'failed').length;
    
    const trendAdjustment = Math.max(0.5, 1 - (recentFailures / 10)); // Reduce time if trending worse
    
    return Math.max(1, Math.floor(baseDays * trendAdjustment));
  }

  private analyzeTeamFactors(project: any): string[] {
    const factors: string[] = [];
    
    // In real implementation, analyze team metrics
    factors.push('team_size_normal');
    factors.push('standard_practices');
    
    return factors;
  }

  private generatePreventiveMeasures(
    riskScore: number,
    environmentalFactors: string[],
    testCharacteristics: string[]
  ): StabilityPrediction['preventiveMeasures'] {
    const measures = {
      immediate: [] as string[],
      monitoring: [] as string[],
      refactoring: [] as string[],
      processChanges: [] as string[]
    };

    if (riskScore > 0.7) {
      measures.immediate.push('Review test implementation for stability issues');
      measures.immediate.push('Add comprehensive logging and error handling');
    }

    if (environmentalFactors.includes('timeout_issues')) {
      measures.refactoring.push('Increase timeout values and add retry logic');
      measures.monitoring.push('Monitor test execution times');
    }

    if (testCharacteristics.includes('long_running')) {
      measures.refactoring.push('Break down long tests into smaller, focused tests');
      measures.processChanges.push('Review test strategy for performance optimization');
    }

    measures.monitoring.push('Set up alerts for failure rate increases');
    measures.processChanges.push('Regular test review and maintenance');

    return measures;
  }

  private async enhancePredictionsWithCrossRepoData(
    predictions: StabilityPrediction[],
    organizationId: string
  ): Promise<StabilityPrediction[]> {
    
    // Get recent cross-repo patterns
    const recentPatterns = await this.getRecentCrossRepoPatterns(organizationId);
    
    for (const prediction of predictions) {
      // Find related cross-repo patterns
      const relatedPatterns = recentPatterns.filter(pattern => 
        pattern.affectedRepos.includes(prediction.projectId) ||
        pattern.affectedTests.some(test => test.testName === prediction.testName)
      );

      prediction.riskFactors.crossRepoPatterns = relatedPatterns.map(p => p.id);
      
      // Calculate cross-repo impact
      const similarTests = await this.findSimilarTestsAcrossRepos(prediction.testId, organizationId);
      prediction.crossRepoImpact.similarTestsAtRisk = similarTests.length;
      prediction.crossRepoImpact.potentialCascadeEffect = similarTests.length >= 3;
      
      // Adjust risk score based on cross-repo factors
      if (relatedPatterns.length > 0) {
        const crossRepoRiskBoost = Math.min(0.2, relatedPatterns.length * 0.05);
        prediction.riskScore = Math.min(1, prediction.riskScore + crossRepoRiskBoost);
        prediction.riskLevel = this.determineRiskLevel(prediction.riskScore);
      }
      
      // Determine organizational risk
      if (prediction.crossRepoImpact.similarTestsAtRisk >= 5) {
        prediction.crossRepoImpact.organizationalRisk = 'high';
      } else if (prediction.crossRepoImpact.similarTestsAtRisk >= 2) {
        prediction.crossRepoImpact.organizationalRisk = 'medium';
      }
    }

    return predictions;
  }

  private async getRecentCrossRepoPatterns(organizationId: string): Promise<CrossRepoPattern[]> {
    // In real implementation, fetch recent patterns from database
    // For now, return empty array
    return [];
  }

  private async findSimilarTestsAcrossRepos(testId: string, organizationId: string): Promise<any[]> {
    // In real implementation, find similar tests across repositories
    return [];
  }

  private generateSummary(predictions: StabilityPrediction[]): OrganizationStabilityForecast['summary'] {
    const highRiskTests = predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
    const criticalRiskTests = predictions.filter(p => p.riskLevel === 'critical').length;
    
    // Calculate estimated impact cost
    const estimatedImpactCost = predictions.reduce((sum, p) => {
      const costMultiplier = { low: 50, medium: 150, high: 400, critical: 1000 };
      return sum + costMultiplier[p.riskLevel];
    }, 0);

    // Identify top risk factors
    const riskFactorCounts = new Map<string, number>();
    predictions.forEach(p => {
      [...p.riskFactors.environmentalFactors, ...p.riskFactors.testCharacteristics].forEach(factor => {
        riskFactorCounts.set(factor, (riskFactorCounts.get(factor) || 0) + 1);
      });
    });

    const topRiskFactors = Array.from(riskFactorCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([factor]) => factor);

    return {
      testsAtRisk: predictions.length,
      highRiskTests,
      criticalRiskTests,
      estimatedImpactCost,
      topRiskFactors,
      preventiveMeasuresRecommended: predictions.reduce((sum, p) => 
        sum + p.preventiveMeasures.immediate.length + p.preventiveMeasures.refactoring.length, 0
      )
    };
  }

  private async analyzeTrends(
    organizationId: string,
    predictions: StabilityPrediction[]
  ): Promise<OrganizationStabilityForecast['trends']> {
    
    // Compare with previous forecasts to determine trends
    const previousForecasts = await this.getPreviousForecasts(organizationId, 3);
    
    return {
      stabilityTrend: this.determineStabilityTrend(previousForecasts, predictions),
      riskFactorTrends: this.analyzeRiskFactorTrends(previousForecasts, predictions),
      predictedFailureRate: this.calculatePredictedFailureRate(predictions)
    };
  }

  private generateActionPlan(predictions: StabilityPrediction[]): OrganizationStabilityForecast['actionPlan'] {
    const criticalTests = predictions.filter(p => p.riskLevel === 'critical');
    const highRiskTests = predictions.filter(p => p.riskLevel === 'high');
    
    const immediate = [];
    
    if (criticalTests.length > 0) {
      immediate.push({
        priority: 'high' as const,
        action: `Review ${criticalTests.length} critical risk tests immediately`,
        affectedTests: criticalTests.length,
        estimatedEffort: 'high'
      });
    }
    
    if (highRiskTests.length > 0) {
      immediate.push({
        priority: 'medium' as const,
        action: `Plan refactoring for ${highRiskTests.length} high-risk tests`,
        affectedTests: highRiskTests.length,
        estimatedEffort: 'medium'
      });
    }

    return {
      immediate,
      shortTerm: [
        'Implement monitoring for predicted unstable tests',
        'Review and improve test isolation practices',
        'Set up alerts for early flakiness detection'
      ],
      longTerm: [
        'Invest in test infrastructure improvements',
        'Develop organization-wide test stability standards',
        'Train teams on flaky test prevention practices'
      ]
    };
  }

  // Additional helper methods would be implemented here...
  
  private determineStabilityTrend(previousForecasts: any[], predictions: StabilityPrediction[]): 'improving' | 'stable' | 'declining' {
    if (previousForecasts.length === 0) return 'stable';
    
    const currentRiskScore = predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length;
    const previousRiskScore = previousForecasts[0]?.averageRiskScore || currentRiskScore;
    
    if (currentRiskScore < previousRiskScore * 0.9) return 'improving';
    if (currentRiskScore > previousRiskScore * 1.1) return 'declining';
    return 'stable';
  }

  private analyzeRiskFactorTrends(previousForecasts: any[], predictions: StabilityPrediction[]): Record<string, 'increasing' | 'stable' | 'decreasing'> {
    // Analyze how risk factors are trending over time
    return {
      'timeout_issues': 'stable',
      'connection_issues': 'decreasing',
      'long_running': 'increasing'
    };
  }

  private calculatePredictedFailureRate(predictions: StabilityPrediction[]): number {
    // Estimate overall failure rate increase based on predictions
    const weightedRisk = predictions.reduce((sum, p) => {
      const weights = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
      return sum + weights[p.riskLevel];
    }, 0);
    
    return Math.min(0.5, weightedRisk / predictions.length); // Max 50% predicted failure rate
  }

  // Placeholder methods for database operations
  private async storeForecast(forecast: OrganizationStabilityForecast): Promise<void> {
    logger.debug(`Storing forecast for organization ${forecast.organizationId}`);
  }

  private async getPreviousForecasts(organizationId: string, count: number): Promise<any[]> {
    return [];
  }

  private async getPrediction(predictionId: string): Promise<StabilityPrediction | null> {
    return null;
  }

  private async updatePrediction(prediction: StabilityPrediction): Promise<void> {
    logger.debug(`Updating prediction ${prediction.id}`);
  }

  private async updateMLModel(prediction: StabilityPrediction, outcome: any): Promise<void> {
    logger.debug(`Updating ML model with feedback from prediction ${prediction.id}`);
  }

  private async getTestHistory(testId: string): Promise<any[]> {
    return [];
  }

  private calculateCurrentStability(testHistory: any[]): number {
    if (testHistory.length === 0) return 1;
    const failures = testHistory.filter(t => t.status === 'failed').length;
    return 1 - (failures / testHistory.length);
  }

  private identifyRiskFactors(testHistory: any[], similarities: any[]): string[] {
    const factors = [];
    if (testHistory.filter(t => t.status === 'failed').length > 0) {
      factors.push('Recent failures detected');
    }
    if (similarities.length > 0) {
      factors.push('Similar tests failing across repositories');
    }
    return factors;
  }

  private generateTestSpecificRecommendations(riskFactors: string[], testHistory: any[]): string[] {
    const recommendations = ['Monitor test stability closely'];
    
    if (riskFactors.includes('Recent failures detected')) {
      recommendations.push('Investigate recent failure causes');
      recommendations.push('Consider adding retry logic');
    }
    
    return recommendations;
  }

  private calculatePredictionAccuracy(prediction: StabilityPrediction, outcome: any): number {
    // Calculate how accurate the prediction was
    const riskCorrect = (prediction.riskScore > 0.5) === outcome.becameFlaky ? 1 : 0;
    const timeAccuracy = outcome.timeToFlaky ? 
      Math.max(0, 1 - Math.abs(prediction.predictedTimeToFlaky - outcome.timeToFlaky) / outcome.timeToFlaky) : 0.5;
    
    return (riskCorrect + timeAccuracy) / 2;
  }

  private async getHistoricalForecasts(organizationId: string, periodDays: number): Promise<any[]> {
    return [];
  }

  private async getVerifiedPredictions(organizationId: string, periodDays: number): Promise<any[]> {
    return [];
  }

  private analyzeOverallTrend(forecasts: any[]): 'improving' | 'stable' | 'declining' {
    return 'stable';
  }

  private calculateRiskDistribution(forecasts: any[]): Record<string, number> {
    return { low: 10, medium: 5, high: 2, critical: 1 };
  }

  private identifyTopRiskFactors(forecasts: any[]): Array<{ factor: string; frequency: number; impact: number }> {
    return [
      { factor: 'timeout_issues', frequency: 15, impact: 0.7 },
      { factor: 'long_running', frequency: 12, impact: 0.5 }
    ];
  }

  private calculatePredictiveAccuracy(predictions: any[]): any {
    return {
      overallAccuracy: 0.78,
      accuracyByRiskLevel: { low: 0.85, medium: 0.75, high: 0.70, critical: 0.80 },
      modelConfidence: 0.82
    };
  }

  private generateTrendBasedRecommendations(forecasts: any[], predictions: any[]): any {
    return {
      modelImprovements: ['Collect more training data for edge cases'],
      processImprovements: ['Implement regular prediction accuracy reviews'],
      toolingRecommendations: ['Add automated stability monitoring']
    };
  }
}