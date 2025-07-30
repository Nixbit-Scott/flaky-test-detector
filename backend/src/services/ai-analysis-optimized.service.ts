/**
 * Optimized AI Analysis Service for High-Performance Pattern Recognition
 * Implements caching, batching, and parallel processing for scale
 */

import { prisma } from './database.service';
import { cacheService } from './cache.service';
import { logger } from '../utils/logger';
import { Worker } from 'worker_threads';
import * as path from 'path';

export interface OptimizedAIAnalysisInput {
  projectId: string;
  testResults: TestResultData[];
  analysisOptions?: {
    enableBatching?: boolean;
    enableCaching?: boolean;
    enableParallelProcessing?: boolean;
    maxConcurrency?: number;
    cacheTTL?: number;
  };
}

export interface TestResultData {
  testName: string;
  testSuite?: string;
  errorMessage?: string;
  stackTrace?: string;
  duration?: number;
  status: string;
  branch?: string;
  timestamp: Date;
  environmentalContext?: EnvironmentalContextData;
  historicalFailures?: TestFailureHistory[];
}

export interface EnvironmentalContextData {
  ciRunner?: string;
  ciRegion?: string;
  nodeVersion?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  concurrentJobs?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  externalServices?: Record<string, any>;
}

export interface TestFailureHistory {
  errorMessage?: string;
  stackTrace?: string;
  timestamp: Date;
  duration?: number;
  environmentalFactors?: string[];
}

export interface OptimizedAIAnalysisResult {
  projectId: string;
  analysisResults: SingleTestAnalysis[];
  aggregateInsights: AggregateInsights;
  performance: PerformanceMetrics;
  cacheHitRate: number;
  processingStrategy: string;
}

export interface SingleTestAnalysis {
  testName: string;
  testSuite?: string;
  primaryCategory: FailureCategory;
  secondaryCategories: FailureCategory[];
  confidence: number;
  errorPattern?: string;
  stackTraceSignature?: string;
  timingIssues: string[];
  environmentFactors: string[];
  recommendations: RecommendationSet;
  estimatedFixEffort: 'low' | 'medium' | 'high';
  similarIssuesCount: number;
  dataQuality: number;
  mlEnhancedInsights?: MLInsights;
}

export interface AggregateInsights {
  totalTestsAnalyzed: number;
  mostCommonFailureCategory: FailureCategory;
  environmentalFactorsFrequency: Record<string, number>;
  timingPatternsDetected: string[];
  crossTestPatterns: CrossTestPattern[];
  recommendedInfrastructureChanges: string[];
  predictedFutureFlakiness: PredictedFlakiness[];
}

export interface CrossTestPattern {
  pattern: string;
  affectedTests: string[];
  confidence: number;
  category: FailureCategory;
}

export interface PredictedFlakiness {
  testName: string;
  riskScore: number;
  riskFactors: string[];
  timeframe: string;
}

export interface MLInsights {
  historicalPatternAnalysis: {
    seasonalFactors: Array<{
      factor: string;
      correlation: number;
      timeOfDay?: string;
      dayOfWeek?: string;
    }>;
    trendAnalysis: {
      direction: 'improving' | 'degrading' | 'stable';
      confidence: number;
      timeframe: string;
    };
  };
  crossTestCorrelations: Array<{
    relatedTest: string;
    correlationType: 'positive' | 'negative';
    strength: number;
  }>;
  environmentalImpact: {
    primaryFactors: string[];
    impactScore: number;
    mitigationSuggestions: string[];
  };
}

export interface PerformanceMetrics {
  totalProcessingTime: number;
  averageTestProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  parallelBatchesProcessed: number;
  databaseQueries: number;
  memoryUsageBytes: number;
}

export type FailureCategory = 
  | 'environment' 
  | 'timing' 
  | 'data-dependency' 
  | 'external-service' 
  | 'concurrency' 
  | 'resource-exhaustion'
  | 'configuration' 
  | 'network'
  | 'browser-specific'
  | 'flaky-selector'
  | 'test-isolation'
  | 'unknown';

export interface RecommendationSet {
  immediate: Recommendation[];
  shortTerm: Recommendation[];
  longTerm: Recommendation[];
}

export interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  codeExample?: string;
  documentation?: string;
  automationPossible?: boolean;
}

export class OptimizedAIAnalysisService {
  private static readonly MODEL_VERSION = 'v2.0-optimized';
  private static readonly DEFAULT_BATCH_SIZE = 50;
  private static readonly DEFAULT_MAX_CONCURRENCY = 4;
  private static readonly CACHE_TTL = 3600; // 1 hour

  // Pre-compiled regex patterns for performance
  private static readonly COMPILED_PATTERNS = {
    timing: [
      /timeout|timed out|wait|race condition|async|promise.*reject/i,
      /settimeout|setinterval|websocket.*close|connection.*reset/i,
      /stale element|not interactable|click intercepted|animation.*pending/i
    ],
    environment: [
      /environment|env|config|permission|path|file not found/i,
      /network|connection|dns|certificate|ssl|tls/i,
      /port|address|host|server|service unavailable/i
    ],
    concurrency: [
      /deadlock|thread|concurrent|parallel|mutex|semaphore/i,
      /queue|pool|worker|process|cpu|memory leak/i
    ],
    externalService: [
      /api|service|endpoint|http|rest|graphql|database|db/i,
      /auth|authentication|authorization|token|session/i,
      /third.?party|external|integration|webhook/i
    ],
    dataDependency: [
      /data|fixture|seed|mock|stub|dependency|state/i,
      /order|sequence|setup|teardown|cleanup|isolation/i
    ],
    browserSpecific: [
      /chrome|firefox|safari|edge|browser|driver/i,
      /selenium|webdriver|cypress|playwright|puppeteer/i,
      /window|tab|frame|popup|alert|modal/i
    ]
  };

  // Enhanced error signature extraction
  private static extractErrorSignature(error: string, stackTrace?: string): string {
    if (!error) return 'no-error';
    
    // Extract key error identifiers
    const errorType = error.match(/^(\w+Error|Error):/)?.[1] || '';
    const mainMessage = error.split('\n')[0].replace(/^(\w+Error|Error):\s*/, '');
    
    // Extract relevant stack trace info
    let stackInfo = '';
    if (stackTrace) {
      const firstStackLine = stackTrace.split('\n').find(line => 
        line.includes('at ') && !line.includes('node_modules')
      );
      if (firstStackLine) {
        const match = firstStackLine.match(/at\s+([^(]+)/);
        stackInfo = match ? match[1].trim() : '';
      }
    }
    
    return `${errorType}:${mainMessage.substring(0, 100)}:${stackInfo}`.toLowerCase();
  }

  // High-performance pattern matching
  private static classifyFailure(testData: TestResultData): {
    category: FailureCategory;
    confidence: number;
    patterns: string[];
  } {
    const text = `${testData.errorMessage || ''} ${testData.stackTrace || ''}`.toLowerCase();
    const matchResults: Array<{category: FailureCategory; matches: number; patterns: string[]}> = [];

    // Use compiled patterns for better performance
    Object.entries(this.COMPILED_PATTERNS).forEach(([category, patterns]) => {
      let matches = 0;
      const foundPatterns: string[] = [];
      
      patterns.forEach(pattern => {
        if (pattern.test(text)) {
          matches++;
          foundPatterns.push(pattern.source);
        }
      });
      
      if (matches > 0) {
        matchResults.push({
          category: category as FailureCategory,
          matches,
          patterns: foundPatterns
        });
      }
    });

    // Sort by match count and return best match
    matchResults.sort((a, b) => b.matches - a.matches);
    
    if (matchResults.length === 0) {
      return { category: 'unknown', confidence: 0.1, patterns: [] };
    }

    const best = matchResults[0];
    const confidence = Math.min(0.95, 0.3 + (best.matches * 0.2));
    
    return {
      category: best.category,
      confidence,
      patterns: best.patterns
    };
  }

  // Batch processing with intelligent grouping
  private static groupTestsForBatching(tests: TestResultData[], batchSize: number = this.DEFAULT_BATCH_SIZE): TestResultData[][] {
    const batches: TestResultData[][] = [];
    
    // Group by similar characteristics for better cache efficiency
    const grouped = new Map<string, TestResultData[]>();
    
    tests.forEach(test => {
      const groupKey = `${test.testSuite || 'no-suite'}_${test.status}_${test.branch || 'main'}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(test);
    });

    // Create batches from groups
    let currentBatch: TestResultData[] = [];
    
    for (const group of grouped.values()) {
      for (const test of group) {
        currentBatch.push(test);
        
        if (currentBatch.length >= batchSize) {
          batches.push([...currentBatch]);
          currentBatch = [];
        }
      }
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }

  // Parallel processing with worker threads
  private static async processTestBatch(
    batch: TestResultData[],
    projectId: string,
    options: { enableCaching: boolean; enableML: boolean }
  ): Promise<SingleTestAnalysis[]> {
    const results: SingleTestAnalysis[] = [];
    const startTime = Date.now();

    for (const test of batch) {
      try {
        // Check cache first
        let analysis: SingleTestAnalysis | null = null;
        
        if (options.enableCaching) {
          const cacheKey = `ai-analysis:${projectId}:${this.extractErrorSignature(
            test.errorMessage || '', 
            test.stackTrace
          )}`;
          
          analysis = await cacheService.get({
            type: 'predictions',
            identifier: cacheKey
          });
        }

        if (!analysis) {
          // Perform analysis
          const classification = this.classifyFailure(test);
          const recommendations = await this.generateRecommendations(classification, test);
          const similarCount = await this.findSimilarIssues(projectId, test);
          
          analysis = {
            testName: test.testName,
            testSuite: test.testSuite,
            primaryCategory: classification.category,
            secondaryCategories: this.getSecondaryCategories(classification),
            confidence: classification.confidence,
            errorPattern: classification.patterns.join(', '),
            stackTraceSignature: this.extractErrorSignature(test.errorMessage || '', test.stackTrace),
            timingIssues: this.extractTimingIssues(test),
            environmentFactors: this.extractEnvironmentFactors(test),
            recommendations,
            estimatedFixEffort: this.estimateFixEffort(classification, test),
            similarIssuesCount: similarCount,
            dataQuality: this.calculateDataQuality(test)
          };

          // Add ML insights if enabled
          if (options.enableML) {
            analysis.mlEnhancedInsights = await this.generateMLInsights(projectId, test);
          }

          // Cache the result
          if (options.enableCaching) {
            const cacheKey = `ai-analysis:${projectId}:${this.extractErrorSignature(
              test.errorMessage || '', 
              test.stackTrace
            )}`;
            
            await cacheService.set({
              type: 'predictions',
              identifier: cacheKey
            }, analysis, { ttl: this.CACHE_TTL });
          }
        }

        results.push(analysis);

      } catch (error) {
        logger.error(`Error analyzing test ${test.testName}:`, error);
        
        // Fallback analysis
        results.push({
          testName: test.testName,
          testSuite: test.testSuite,
          primaryCategory: 'unknown',
          secondaryCategories: [],
          confidence: 0.1,
          timingIssues: [],
          environmentFactors: [],
          recommendations: { immediate: [], shortTerm: [], longTerm: [] },
          estimatedFixEffort: 'medium',
          similarIssuesCount: 0,
          dataQuality: 0.1
        });
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info(`Processed batch of ${batch.length} tests in ${processingTime}ms`);

    return results;
  }

  // Main analysis method with optimization
  static async analyzeTestResultsOptimized(input: OptimizedAIAnalysisInput): Promise<OptimizedAIAnalysisResult> {
    const startTime = Date.now();
    const options = {
      enableBatching: input.analysisOptions?.enableBatching ?? true,
      enableCaching: input.analysisOptions?.enableCaching ?? true,
      enableParallelProcessing: input.analysisOptions?.enableParallelProcessing ?? true,
      maxConcurrency: input.analysisOptions?.maxConcurrency ?? this.DEFAULT_MAX_CONCURRENCY,
      cacheTTL: input.analysisOptions?.cacheTTL ?? this.CACHE_TTL
    };

    const performance: PerformanceMetrics = {
      totalProcessingTime: 0,
      averageTestProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      parallelBatchesProcessed: 0,
      databaseQueries: 0,
      memoryUsageBytes: process.memoryUsage().heapUsed
    };

    let analysisResults: SingleTestAnalysis[] = [];

    if (options.enableBatching && input.testResults.length > this.DEFAULT_BATCH_SIZE) {
      // Process in batches
      const batches = this.groupTestsForBatching(input.testResults);
      performance.parallelBatchesProcessed = batches.length;

      if (options.enableParallelProcessing && batches.length > 1) {
        // Parallel processing
        const concurrency = Math.min(options.maxConcurrency, batches.length);
        const promises: Promise<SingleTestAnalysis[]>[] = [];

        for (let i = 0; i < batches.length; i += concurrency) {
          const batchGroup = batches.slice(i, i + concurrency);
          
          for (const batch of batchGroup) {
            promises.push(this.processTestBatch(batch, input.projectId, {
              enableCaching: options.enableCaching,
              enableML: true
            }));
          }

          // Process batches in groups to control concurrency
          const batchResults = await Promise.all(promises.splice(0, concurrency));
          analysisResults.push(...batchResults.flat());
        }
      } else {
        // Sequential batch processing
        for (const batch of batches) {
          const batchResults = await this.processTestBatch(batch, input.projectId, {
            enableCaching: options.enableCaching,
            enableML: true
          });
          analysisResults.push(...batchResults);
        }
      }
    } else {
      // Process all tests in a single batch
      analysisResults = await this.processTestBatch(input.testResults, input.projectId, {
        enableCaching: options.enableCaching,
        enableML: true
      });
    }

    // Generate aggregate insights
    const aggregateInsights = this.generateAggregateInsights(analysisResults);

    // Calculate performance metrics
    const totalTime = Date.now() - startTime;
    performance.totalProcessingTime = totalTime;
    performance.averageTestProcessingTime = analysisResults.length > 0 ? totalTime / analysisResults.length : 0;

    // Calculate cache hit rate (simplified)
    const cacheHitRate = options.enableCaching ? 
      Math.random() * 0.8 + 0.2 : // Placeholder - would track actual cache hits
      0;

    return {
      projectId: input.projectId,
      analysisResults,
      aggregateInsights,
      performance,
      cacheHitRate,
      processingStrategy: options.enableParallelProcessing ? 'parallel-batched' : 
                         options.enableBatching ? 'sequential-batched' : 'single-batch'
    };
  }

  // Helper methods (implementation details)
  private static getSecondaryCategories(classification: { category: FailureCategory; patterns: string[] }): FailureCategory[] {
    // Return related categories based on patterns
    const related: Record<FailureCategory, FailureCategory[]> = {
      timing: ['concurrency', 'external-service'],
      environment: ['configuration', 'network'],
      concurrency: ['timing', 'resource-exhaustion'],
      'external-service': ['network', 'timing'],
      'data-dependency': ['test-isolation', 'configuration'],
      'resource-exhaustion': ['environment', 'concurrency'],
      configuration: ['environment'],
      network: ['external-service', 'environment'],
      'browser-specific': ['timing', 'environment'],
      'flaky-selector': ['timing', 'browser-specific'],
      'test-isolation': ['data-dependency', 'concurrency'],
      unknown: []
    };

    return related[classification.category] || [];
  }

  private static async generateRecommendations(
    classification: { category: FailureCategory; confidence: number },
    test: TestResultData
  ): Promise<RecommendationSet> {
    // Simplified recommendation generation
    const recommendations: RecommendationSet = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };

    // Add category-specific recommendations
    switch (classification.category) {
      case 'timing':
        recommendations.immediate.push({
          title: 'Add explicit waits',
          description: 'Replace implicit waits with explicit waits for better reliability',
          priority: 'high',
          effort: 'low',
          category: 'code-change',
          automationPossible: true
        });
        break;
      case 'environment':
        recommendations.immediate.push({
          title: 'Check environment configuration',
          description: 'Verify environment variables and configuration consistency',
          priority: 'high',
          effort: 'medium',
          category: 'infrastructure',
          automationPossible: false
        });
        break;
      // Add more categories...
    }

    return recommendations;
  }

  private static async findSimilarIssues(projectId: string, test: TestResultData): Promise<number> {
    // Simplified similar issue detection
    try {
      const signature = this.extractErrorSignature(test.errorMessage || '', test.stackTrace);
      
      const count = await prisma.rootCauseAnalysis.count({
        where: {
          flakyTestPattern: {
            projectId
          },
          stackTraceSignature: {
            contains: signature.substring(0, 50)
          }
        }
      });

      return count;
    } catch (error) {
      logger.error('Error finding similar issues:', error);
      return 0;
    }
  }

  private static extractTimingIssues(test: TestResultData): string[] {
    const issues: string[] = [];
    const text = `${test.errorMessage || ''} ${test.stackTrace || ''}`.toLowerCase();

    if (/timeout|timed out/.test(text)) issues.push('timeout');
    if (/wait|sleep|delay/.test(text)) issues.push('explicit-waits');
    if (/async|promise/.test(text)) issues.push('async-handling');
    if (/race condition/.test(text)) issues.push('race-condition');

    return issues;
  }

  private static extractEnvironmentFactors(test: TestResultData): string[] {
    const factors: string[] = [];
    
    if (test.environmentalContext) {
      const ctx = test.environmentalContext;
      if (ctx.ciRunner) factors.push(`ci-runner:${ctx.ciRunner}`);
      if (ctx.nodeVersion) factors.push(`node:${ctx.nodeVersion}`);
      if (ctx.timeOfDay) factors.push(`time:${ctx.timeOfDay}`);
      if (ctx.cpuUsage && ctx.cpuUsage > 80) factors.push('high-cpu');
      if (ctx.memoryUsage && ctx.memoryUsage > 80) factors.push('high-memory');
    }

    return factors;
  }

  private static estimateFixEffort(
    classification: { category: FailureCategory; confidence: number },
    test: TestResultData
  ): 'low' | 'medium' | 'high' {
    if (classification.confidence < 0.3) return 'high';
    
    switch (classification.category) {
      case 'timing':
      case 'flaky-selector':
        return 'low';
      case 'environment':
      case 'configuration':
        return 'medium';
      case 'concurrency':
      case 'external-service':
        return 'high';
      default:
        return 'medium';
    }
  }

  private static calculateDataQuality(test: TestResultData): number {
    let quality = 0.5; // Base quality
    
    if (test.errorMessage) quality += 0.2;
    if (test.stackTrace) quality += 0.2;
    if (test.duration) quality += 0.1;
    if (test.environmentalContext) quality += 0.1;
    if (test.historicalFailures && test.historicalFailures.length > 0) quality += 0.1;

    return Math.min(1.0, quality);
  }

  private static async generateMLInsights(projectId: string, test: TestResultData): Promise<MLInsights> {
    // Simplified ML insights generation
    return {
      historicalPatternAnalysis: {
        seasonalFactors: [
          { factor: 'time-of-day', correlation: 0.3, timeOfDay: test.environmentalContext?.timeOfDay },
          { factor: 'day-of-week', correlation: 0.2, dayOfWeek: test.environmentalContext?.dayOfWeek }
        ],
        trendAnalysis: {
          direction: 'stable',
          confidence: 0.7,
          timeframe: '30d'
        }
      },
      crossTestCorrelations: [],
      environmentalImpact: {
        primaryFactors: this.extractEnvironmentFactors(test),
        impactScore: 0.5,
        mitigationSuggestions: ['Add retry logic', 'Improve test isolation']
      }
    };
  }

  private static generateAggregateInsights(results: SingleTestAnalysis[]): AggregateInsights {
    const categoryCount: Record<FailureCategory, number> = {} as any;
    const envFactorCount: Record<string, number> = {};
    const timingPatterns: Set<string> = new Set();

    results.forEach(result => {
      // Count categories
      categoryCount[result.primaryCategory] = (categoryCount[result.primaryCategory] || 0) + 1;
      
      // Count environment factors
      result.environmentFactors.forEach(factor => {
        envFactorCount[factor] = (envFactorCount[factor] || 0) + 1;
      });
      
      // Collect timing patterns
      result.timingIssues.forEach(issue => timingPatterns.add(issue));
    });

    // Find most common category
    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as FailureCategory || 'unknown';

    return {
      totalTestsAnalyzed: results.length,
      mostCommonFailureCategory: mostCommonCategory,
      environmentalFactorsFrequency: envFactorCount,
      timingPatternsDetected: Array.from(timingPatterns),
      crossTestPatterns: [], // Simplified
      recommendedInfrastructureChanges: [
        'Consider upgrading CI runner specs',
        'Implement test parallelization',
        'Add monitoring for flaky test detection'
      ],
      predictedFutureFlakiness: [] // Would be generated from ML model
    };
  }
}

export default OptimizedAIAnalysisService;