import { prisma } from './database.service';
import { TestResultData, TestRunData } from './test-result.service';
import { AIAnalysisService, AIAnalysisInput } from './ai-analysis.service';

export interface FlakyTestAnalysis {
  testName: string;
  testSuite?: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  confidence: number;
  isFlaky: boolean;
  pattern: 'intermittent' | 'environment-dependent' | 'timing-sensitive' | 'unknown';
  recommendations: string[];
  // Enhanced with AI Analysis
  aiAnalysis?: {
    primaryCategory: string;
    confidence: number;
    recommendations: any;
    estimatedFixEffort: string;
  };
}

export interface FlakyDetectionConfig {
  minRuns: number; // Minimum runs to consider for analysis
  flakyThreshold: number; // Failure rate threshold (0.0 - 1.0)
  confidenceThreshold: number; // Minimum confidence to mark as flaky
  lookbackDays: number; // Days to look back for analysis
}

export class FlakyTestDetectionService {
  private static defaultConfig: FlakyDetectionConfig = {
    minRuns: 5,
    flakyThreshold: 0.15, // 15% failure rate
    confidenceThreshold: 0.7, // 70% confidence
    lookbackDays: 30,
  };

  /**
   * Analyze test results to detect flaky patterns
   */
  static async analyzeTestResults(projectId: string, config?: Partial<FlakyDetectionConfig>): Promise<FlakyTestAnalysis[]> {
    const analysisConfig = { ...this.defaultConfig, ...config };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - analysisConfig.lookbackDays);

    // Get all test results for the project within the lookback period
    const testResults = await prisma.testResult.findMany({
      where: {
        testRun: {
          projectId,
          startedAt: {
            gte: cutoffDate,
          },
        },
      },
      include: {
        testRun: {
          select: {
            id: true,
            branch: true,
            commit: true,
            startedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by test name and suite
    const testGroups = this.groupTestResults(testResults);
    
    const analyses: FlakyTestAnalysis[] = [];

    for (const [testKey, results] of testGroups.entries()) {
      if (results.length < analysisConfig.minRuns) {
        continue; // Not enough data
      }

      const analysis = this.analyzeTestGroup(testKey, results, analysisConfig);
      
      if (analysis.isFlaky) {
        analyses.push(analysis);
        
        // Update or create flaky test pattern in database
        await this.updateFlakyTestPattern(projectId, analysis);
      }
    }

    return analyses;
  }

  /**
   * Analyze a new test run for immediate flaky test detection
   */
  static async analyzeNewTestRun(testRunData: TestRunData): Promise<FlakyTestAnalysis[]> {
    const project = await prisma.project.findUnique({
      where: { id: testRunData.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const config: FlakyDetectionConfig = {
      minRuns: this.defaultConfig.minRuns,
      flakyThreshold: project.flakyThreshold,
      confidenceThreshold: this.defaultConfig.confidenceThreshold,
      lookbackDays: this.defaultConfig.lookbackDays,
    };

    return this.analyzeTestResults(testRunData.projectId, config);
  }

  /**
   * Get current flaky tests for a project
   */
  static async getFlakyTests(projectId: string): Promise<any[]> {
    const flakyTests = await prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: {
        confidence: 'desc',
      },
    });

    return flakyTests;
  }

  /**
   * Check if a specific test is known to be flaky
   */
  static async isTestFlaky(projectId: string, testName: string, testSuite?: string): Promise<boolean> {
    const whereClause = {
      projectId,
      testName,
      ...(testSuite ? { testSuite } : { testSuite: null }),
    };

    const pattern = await prisma.flakyTestPattern.findUnique({
      where: {
        projectId_testName_testSuite: whereClause as any,
      },
    });

    return pattern?.isActive === true && pattern.confidence >= this.defaultConfig.confidenceThreshold;
  }

  /**
   * Group test results by test name and suite
   */
  private static groupTestResults(testResults: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const result of testResults) {
      const key = `${result.testName}::${result.testSuite || 'default'}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key)!.push(result);
    }

    return groups;
  }

  /**
   * Analyze a group of test results for flaky patterns
   */
  private static analyzeTestGroup(testKey: string, results: any[], config: FlakyDetectionConfig): FlakyTestAnalysis {
    const [testName, testSuite] = testKey.split('::');
    const actualTestSuite = testSuite === 'default' ? undefined : testSuite;

    const totalRuns = results.length;
    const failedRuns = results.filter(r => r.status === 'failed').length;
    const failureRate = failedRuns / totalRuns;

    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(results, failureRate);
    
    // Determine if test is flaky
    const isFlaky = failureRate >= config.flakyThreshold && 
                   failureRate < 0.95 && // Not consistently failing
                   confidence >= config.confidenceThreshold;

    // Analyze failure pattern
    const pattern = this.identifyFailurePattern(results);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(pattern, failureRate, results);

    return {
      testName,
      testSuite: actualTestSuite,
      failureRate,
      totalRuns,
      failedRuns,
      confidence,
      isFlaky,
      pattern,
      recommendations,
    };
  }

  /**
   * Calculate confidence score based on various factors
   */
  private static calculateConfidence(results: any[], failureRate: number): number {
    const totalRuns = results.length;
    
    // Base confidence from sample size
    let confidence = Math.min(totalRuns / 20, 1.0); // Max confidence at 20+ runs
    
    // Penalize very high or very low failure rates (likely not flaky)
    if (failureRate < 0.05 || failureRate > 0.95) {
      confidence *= 0.3;
    } else if (failureRate >= 0.1 && failureRate <= 0.6) {
      confidence *= 1.2; // Boost for typical flaky range
    }

    // Check for temporal patterns (flaky tests often have temporal clustering)
    const hasTemporalPattern = this.hasTemporalPattern(results);
    if (hasTemporalPattern) {
      confidence *= 1.1;
    }

    // Check for branch/environment patterns
    const hasBranchPattern = this.hasBranchPattern(results);
    if (hasBranchPattern) {
      confidence *= 1.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Identify the type of failure pattern
   */
  private static identifyFailurePattern(results: any[]): 'intermittent' | 'environment-dependent' | 'timing-sensitive' | 'unknown' {
    // Check for branch-specific failures
    const branchGroups = this.groupBy(results, r => r.testRun.branch);
    if (branchGroups.size > 1) {
      const branchFailureRates = Array.from(branchGroups.entries()).map(([branch, runs]) => {
        const failures = runs.filter(r => r.status === 'failed').length;
        return failures / runs.length;
      });
      
      const variance = this.calculateVariance(branchFailureRates);
      if (variance > 0.1) {
        return 'environment-dependent';
      }
    }

    // Check for timing patterns (consecutive failures/passes)
    const hasConsecutivePatterns = this.hasConsecutiveFailurePattern(results);
    if (hasConsecutivePatterns) {
      return 'timing-sensitive';
    }

    // Check error messages for timing-related issues
    const timingKeywords = ['timeout', 'race condition', 'timing', 'wait', 'async'];
    const hasTimingErrors = results.some(r => 
      r.errorMessage && timingKeywords.some(keyword => 
        r.errorMessage.toLowerCase().includes(keyword)
      )
    );
    
    if (hasTimingErrors) {
      return 'timing-sensitive';
    }

    return 'intermittent';
  }

  /**
   * Generate actionable recommendations
   */
  private static generateRecommendations(
    pattern: string, 
    failureRate: number, 
    results: any[]
  ): string[] {
    const recommendations: string[] = [];

    switch (pattern) {
      case 'timing-sensitive':
        recommendations.push('Add explicit waits or increase timeout values');
        recommendations.push('Review async operations and race conditions');
        recommendations.push('Consider using deterministic test data');
        break;
        
      case 'environment-dependent':
        recommendations.push('Check test environment setup and teardown');
        recommendations.push('Verify dependencies and external services');
        recommendations.push('Ensure proper test isolation');
        break;
        
      case 'intermittent':
        recommendations.push('Review test logic for non-deterministic behavior');
        recommendations.push('Check for shared state between tests');
        recommendations.push('Increase test stability with retry mechanisms');
        break;
        
      default:
        recommendations.push('Investigate test for non-deterministic behavior');
        recommendations.push('Consider adding logging for better debugging');
    }

    if (failureRate > 0.3) {
      recommendations.push('High failure rate - prioritize fixing this test');
    }

    // Check for common error patterns
    const errorMessages = results
      .filter(r => r.errorMessage)
      .map(r => r.errorMessage.toLowerCase());
    
    if (errorMessages.some(msg => msg.includes('network') || msg.includes('connection'))) {
      recommendations.push('Network-related failures detected - add retry logic for network calls');
    }

    return recommendations;
  }

  /**
   * Perform AI-enhanced analysis of a flaky test
   */
  static async performAIAnalysis(
    projectId: string, 
    analysis: FlakyTestAnalysis, 
    recentFailures: any[]
  ): Promise<FlakyTestAnalysis> {
    if (!analysis.isFlaky || recentFailures.length === 0) {
      return analysis;
    }

    try {
      // Get the most recent failure with good error data
      const bestFailure = recentFailures
        .filter(f => f.status === 'failed' && (f.errorMessage || f.stackTrace))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (!bestFailure) {
        return analysis;
      }

      // Prepare AI analysis input
      const aiInput: AIAnalysisInput = {
        testName: analysis.testName,
        testSuite: analysis.testSuite,
        errorMessage: bestFailure.errorMessage,
        stackTrace: bestFailure.stackTrace,
        duration: bestFailure.duration,
        status: bestFailure.status,
        branch: bestFailure.testRun?.branch,
        historicalFailures: recentFailures.map(f => ({
          errorMessage: f.errorMessage,
          stackTrace: f.stackTrace,
          timestamp: new Date(f.createdAt),
          duration: f.duration,
        })),
      };

      // Perform AI analysis
      const aiResult = await AIAnalysisService.analyzeFailure(aiInput);

      // Find or create flaky test pattern to link AI analysis
      const flakyPattern = await prisma.flakyTestPattern.findFirst({
        where: {
          projectId,
          testName: analysis.testName,
          testSuite: analysis.testSuite || null,
        },
      });

      if (flakyPattern) {
        // Store AI analysis in database
        await AIAnalysisService.storeAnalysis(
          flakyPattern.id,
          bestFailure.id,
          aiResult
        );

        // Enhance the analysis with AI insights
        analysis.aiAnalysis = {
          primaryCategory: aiResult.primaryCategory,
          confidence: aiResult.confidence,
          recommendations: aiResult.recommendations,
          estimatedFixEffort: aiResult.estimatedFixEffort,
        };
      }

      return analysis;
    } catch (error) {
      console.error('AI Analysis failed:', error);
      return analysis; // Return original analysis if AI fails
    }
  }

  /**
   * Get flaky tests with AI analysis
   */
  static async getFlakyTestsWithAI(projectId: string): Promise<any[]> {
    const flakyTests = await prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        isActive: true,
      },
      include: {
        rootCauseAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get latest analysis
        },
      },
      orderBy: {
        confidence: 'desc',
      },
    });

    return flakyTests.map(test => ({
      ...test,
      latestAnalysis: test.rootCauseAnalyses[0] || null,
      analysisCount: test.rootCauseAnalyses.length,
    }));
  }

  /**
   * Trigger AI analysis for a specific test failure
   */
  static async triggerAIAnalysisForFailure(testResultId: string): Promise<string | null> {
    try {
      const testResult = await prisma.testResult.findUnique({
        where: { id: testResultId },
        include: {
          testRun: {
            select: {
              projectId: true,
              branch: true,
            },
          },
        },
      });

      if (!testResult || testResult.status !== 'failed') {
        return null;
      }

      // Check if this test is already identified as flaky
      const flakyPattern = await prisma.flakyTestPattern.findFirst({
        where: {
          projectId: testResult.testRun.projectId,
          testName: testResult.testName,
          testSuite: testResult.testSuite || null,
          isActive: true,
        },
      });

      if (!flakyPattern) {
        return null; // Only analyze known flaky tests
      }

      // Get recent failures for context
      const recentFailures = await prisma.testResult.findMany({
        where: {
          testName: testResult.testName,
          testSuite: testResult.testSuite,
          status: 'failed',
          testRun: {
            projectId: testResult.testRun.projectId,
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        include: {
          testRun: {
            select: { branch: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Prepare AI analysis input
      const aiInput: AIAnalysisInput = {
        testName: testResult.testName,
        testSuite: testResult.testSuite || undefined,
        errorMessage: testResult.errorMessage || undefined,
        stackTrace: testResult.stackTrace || undefined,
        duration: testResult.duration || undefined,
        status: testResult.status,
        branch: testResult.testRun.branch,
        historicalFailures: recentFailures.map(f => ({
          errorMessage: f.errorMessage || undefined,
          stackTrace: f.stackTrace || undefined,
          timestamp: f.createdAt,
          duration: f.duration || undefined,
        })),
      };

      // Perform AI analysis
      const aiResult = await AIAnalysisService.analyzeFailure(aiInput);

      // Store the analysis
      const analysis = await prisma.rootCauseAnalysis.create({
        data: {
          flakyTestPatternId: flakyPattern.id,
          testResultId: testResult.id,
          primaryCategory: aiResult.primaryCategory,
          secondaryCategories: aiResult.secondaryCategories,
          confidence: aiResult.confidence,
          errorPattern: aiResult.errorPattern,
          stackTraceSignature: aiResult.stackTraceSignature,
          timingIssues: aiResult.timingIssues,
          environmentFactors: aiResult.environmentFactors,
          recommendations: aiResult.recommendations as any,
          estimatedFixEffort: aiResult.estimatedFixEffort,
          similarIssuesCount: aiResult.similarIssuesCount,
          modelVersion: aiResult.modelVersion,
          processingTime: aiResult.processingTime,
          dataQuality: aiResult.dataQuality,
        },
      });

      return analysis.id;
    } catch (error) {
      console.error('Failed to trigger AI analysis:', error);
      return null;
    }
  }

  /**
   * Update or create flaky test pattern in database
   */
  private static async updateFlakyTestPattern(projectId: string, analysis: FlakyTestAnalysis): Promise<void> {
    const whereClause = {
      projectId,
      testName: analysis.testName,
      ...(analysis.testSuite ? { testSuite: analysis.testSuite } : { testSuite: null }),
    };

    await prisma.flakyTestPattern.upsert({
      where: {
        projectId_testName_testSuite: whereClause as any,
      },
      update: {
        failureRate: analysis.failureRate,
        totalRuns: analysis.totalRuns,
        failedRuns: analysis.failedRuns,
        confidence: analysis.confidence,
        lastSeen: new Date(),
        isActive: analysis.isFlaky,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        testName: analysis.testName,
        testSuite: analysis.testSuite || null,
        failureRate: analysis.failureRate,
        totalRuns: analysis.totalRuns,
        failedRuns: analysis.failedRuns,
        confidence: analysis.confidence,
        isActive: analysis.isFlaky,
      },
    });
  }

  // Helper methods
  private static hasTemporalPattern(results: any[]): boolean {
    // Sort by date and check for clustering
    const sorted = results.sort((a, b) => 
      new Date(a.testRun.startedAt).getTime() - new Date(b.testRun.startedAt).getTime()
    );
    
    const failures = sorted.filter(r => r.status === 'failed');
    if (failures.length < 2) return false;
    
    // Check if failures are clustered within 24-hour periods
    for (let i = 1; i < failures.length; i++) {
      const timeDiff = new Date(failures[i].testRun.startedAt).getTime() - 
                      new Date(failures[i-1].testRun.startedAt).getTime();
      if (timeDiff < 24 * 60 * 60 * 1000) { // Within 24 hours
        return true;
      }
    }
    
    return false;
  }

  private static hasBranchPattern(results: any[]): boolean {
    const branchGroups = this.groupBy(results, r => r.testRun.branch);
    if (branchGroups.size < 2) return false;
    
    const branchFailureRates = Array.from(branchGroups.entries()).map(([_, runs]) => {
      const failures = runs.filter(r => r.status === 'failed').length;
      return failures / runs.length;
    });
    
    const max = Math.max(...branchFailureRates);
    const min = Math.min(...branchFailureRates);
    
    return (max - min) > 0.2; // Significant difference in failure rates
  }

  private static hasConsecutiveFailurePattern(results: any[]): boolean {
    const sorted = results.sort((a, b) => 
      new Date(a.testRun.startedAt).getTime() - new Date(b.testRun.startedAt).getTime()
    );
    
    let consecutiveFailures = 0;
    let maxConsecutive = 0;
    
    for (const result of sorted) {
      if (result.status === 'failed') {
        consecutiveFailures++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveFailures);
      } else {
        consecutiveFailures = 0;
      }
    }
    
    return maxConsecutive >= 3; // 3+ consecutive failures
  }

  private static groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    
    for (const item of array) {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    
    return groups;
  }

  private static calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }
}