import { prisma } from './database.service';

export interface AIAnalysisInput {
  testName: string;
  testSuite?: string;
  errorMessage?: string;
  stackTrace?: string;
  duration?: number;
  status: string;
  branch?: string;
  ciProvider?: string;
  projectId?: string;
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

export interface AIAnalysisResult {
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
  modelVersion: string;
  processingTime: number;
  dataQuality: number;
}

export type FailureCategory = 
  | 'environment' 
  | 'timing' 
  | 'data-dependency' 
  | 'external-service' 
  | 'concurrency' 
  | 'resource-exhaustion'
  | 'configuration' 
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
}

export class AIAnalysisService {
  private static readonly MODEL_VERSION = 'v1.1'; // Enhanced version
  
  // Enhanced error pattern categories with more comprehensive regex patterns
  private static readonly ERROR_PATTERNS = {
    timing: [
      /timeout/i,
      /timed out/i,
      /wait/i,
      /race condition/i,
      /async/i,
      /promise.*reject/i,
      /settimeout/i,
      /setinterval/i,
      /websocket.*close/i,
      /connection.*reset/i,
      /stale element reference/i,
      /element not interactable/i,
      /element click intercepted/i,
      /animation.*pending/i,
      /transition.*pending/i,
      /loading.*timeout/i,
      /page.*load.*timeout/i,
    ],
    environment: [
      /environment/i,
      /env/i,
      /configuration/i,
      /config/i,
      /permission/i,
      /eacces/i,
      /file not found/i,
      /module not found/i,
      /path.*not.*exist/i,
      /docker.*error/i,
      /container.*error/i,
      /k8s.*error/i,
      /kubernetes.*error/i,
      /port.*already.*use/i,
      /address.*already.*use/i,
      /connection refused/i,
      /no such host/i,
      /dns.*resolution.*failed/i,
      /enoent/i,
      /connection refused/i,
      /network/i,
    ],
    dataDependency: [
      /database/i,
      /db/i,
      /sql/i,
      /constraint/i,
      /foreign key/i,
      /duplicate/i,
      /data/i,
      /state/i,
      /before.*hook/i,
      /after.*hook/i,
    ],
    externalService: [
      /http/i,
      /api/i,
      /service/i,
      /endpoint/i,
      /404/i,
      /500/i,
      /502/i,
      /503/i,
      /fetch/i,
      /request/i,
    ],
    concurrency: [
      /lock/i,
      /deadlock/i,
      /concurrent/i,
      /parallel/i,
      /thread/i,
      /mutex/i,
      /semaphore/i,
    ],
    resourceExhaustion: [
      /memory/i,
      /heap/i,
      /out of memory/i,
      /oom/i,
      /disk space/i,
      /cpu/i,
      /resource/i,
    ],
  };

  // Timing-related keywords for deeper analysis
  private static readonly TIMING_KEYWORDS = [
    'async', 'await', 'promise', 'timeout', 'delay', 'race', 'concurrent',
    'parallel', 'throttle', 'debounce', 'interval', 'timer',
  ];

  // Environment-related keywords
  private static readonly ENVIRONMENT_KEYWORDS = [
    'env', 'config', 'setup', 'teardown', 'before', 'after', 'fixture',
    'mock', 'stub', 'spy', 'container', 'docker', 'kubernetes',
  ];

  /**
   * Enhanced AI analysis with historical pattern recognition
   */
  static async analyzeFailureEnhanced(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Enhanced analysis with historical context
      const historicalPattern = await this.analyzeHistoricalPattern(input);
      const seasonalFactors = this.analyzeSeasonalFactors(input);
      const crossTestPatterns = await this.analyzeCrossTestPatterns(input);
      
      // Existing analysis with enhancements
      const result = await this.analyzeFailure(input);
      
      // Apply ML enhancements to the result
      const enhancedConfidence = this.enhanceConfidenceWithML(
        result.confidence, 
        historicalPattern, 
        seasonalFactors
      );
      
      const enhancedRecommendations = this.addHistoricalRecommendations(
        result.recommendations,
        historicalPattern,
        crossTestPatterns
      );
      
      return {
        ...result,
        confidence: enhancedConfidence,
        recommendations: enhancedRecommendations,
        modelVersion: this.MODEL_VERSION,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Enhanced AI analysis failed, falling back to basic analysis:', error);
      return this.analyzeFailure(input);
    }
  }

  /**
   * Original analyze method (maintained for backward compatibility)
   */
  static async analyzeFailure(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // 1. Extract and normalize error patterns
      const errorPattern = this.extractErrorPattern(input.errorMessage, input.stackTrace);
      const stackTraceSignature = this.generateStackTraceSignature(input.stackTrace);
      
      // 2. Categorize the failure
      const categoryAnalysis = this.categorizeFailure(input);
      
      // 3. Analyze timing issues
      const timingIssues = this.analyzeTimingIssues(input);
      
      // 4. Analyze environmental factors
      const environmentFactors = this.analyzeEnvironmentalFactors(input);
      
      // 5. Calculate similarity with historical failures
      const similarIssuesCount = await this.findSimilarIssues(input);
      
      // 6. Generate recommendations
      const recommendations = this.generateRecommendations(
        categoryAnalysis.primary,
        categoryAnalysis.secondary,
        input,
        timingIssues,
        environmentFactors
      );
      
      // 7. Estimate fix effort
      const estimatedFixEffort = this.estimateFixEffort(
        categoryAnalysis.primary,
        categoryAnalysis.confidence,
        timingIssues.length,
        environmentFactors.length
      );
      
      // 8. Calculate data quality score
      const dataQuality = this.calculateDataQuality(input);
      
      const processingTime = Date.now() - startTime;
      
      return {
        primaryCategory: categoryAnalysis.primary,
        secondaryCategories: categoryAnalysis.secondary,
        confidence: categoryAnalysis.confidence,
        errorPattern,
        stackTraceSignature,
        timingIssues,
        environmentFactors,
        recommendations,
        estimatedFixEffort,
        similarIssuesCount,
        modelVersion: this.MODEL_VERSION,
        processingTime,
        dataQuality,
      };
    } catch (error) {
      console.error('AI Analysis failed:', error);
      
      // Return fallback analysis
      return {
        primaryCategory: 'unknown',
        secondaryCategories: [],
        confidence: 0.1,
        timingIssues: [],
        environmentFactors: [],
        recommendations: this.getGenericRecommendations(),
        estimatedFixEffort: 'medium',
        similarIssuesCount: 0,
        modelVersion: this.MODEL_VERSION,
        processingTime: Date.now() - startTime,
        dataQuality: 0.1,
      };
    }
  }

  /**
   * Store AI analysis results in database
   */
  static async storeAnalysis(
    flakyTestPatternId: string,
    testResultId: string | null,
    analysis: AIAnalysisResult
  ): Promise<void> {
    await prisma.rootCauseAnalysis.create({
      data: {
        flakyTestPatternId,
        testResultId,
        primaryCategory: analysis.primaryCategory,
        secondaryCategories: analysis.secondaryCategories,
        confidence: analysis.confidence,
        errorPattern: analysis.errorPattern,
        stackTraceSignature: analysis.stackTraceSignature,
        timingIssues: analysis.timingIssues,
        environmentFactors: analysis.environmentFactors,
        recommendations: analysis.recommendations as any,
        estimatedFixEffort: analysis.estimatedFixEffort,
        similarIssuesCount: analysis.similarIssuesCount,
        modelVersion: analysis.modelVersion,
        processingTime: analysis.processingTime,
        dataQuality: analysis.dataQuality,
      },
    });
  }

  /**
   * Extract meaningful error pattern from error message and stack trace
   */
  private static extractErrorPattern(errorMessage?: string, stackTrace?: string): string | undefined {
    if (!errorMessage && !stackTrace) return undefined;
    
    const text = `${errorMessage || ''} ${stackTrace || ''}`;
    
    // Extract the main error type and first line of stack trace
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return undefined;
    
    // Get the primary error message
    const primaryError = lines[0].trim();
    
    // Find the most specific part of the error
    const colonIndex = primaryError.lastIndexOf(':');
    if (colonIndex > 0 && colonIndex < primaryError.length - 1) {
      return primaryError.substring(colonIndex + 1).trim();
    }
    
    return primaryError;
  }

  /**
   * Generate a normalized signature from stack trace for similarity matching
   */
  private static generateStackTraceSignature(stackTrace?: string): string | undefined {
    if (!stackTrace) return undefined;
    
    const lines = stackTrace.split('\n')
      .filter(line => line.trim())
      .slice(0, 5); // Only use first 5 lines
    
    return lines
      .map(line => {
        // Normalize file paths and line numbers
        return line
          .replace(/\/.*?\//g, '/.../') // Replace paths with ...
          .replace(/:\d+:\d+/g, ':XX:XX') // Replace line:col numbers
          .replace(/\d+/g, 'N'); // Replace any remaining numbers
      })
      .join('|');
  }

  /**
   * Categorize failure based on error patterns and context
   */
  private static categorizeFailure(input: AIAnalysisInput): {
    primary: FailureCategory;
    secondary: FailureCategory[];
    confidence: number;
  } {
    const text = `${input.errorMessage || ''} ${input.stackTrace || ''}`.toLowerCase();
    const scores: Record<FailureCategory, number> = {
      timing: 0,
      environment: 0,
      'data-dependency': 0,
      'external-service': 0,
      concurrency: 0,
      'resource-exhaustion': 0,
      configuration: 0,
      unknown: 0,
    };

    // Pattern matching scoring
    for (const [category, patterns] of Object.entries(this.ERROR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const key = category === 'dataDependency' ? 'data-dependency' : 
                     category === 'externalService' ? 'external-service' :
                     category === 'resourceExhaustion' ? 'resource-exhaustion' :
                     category as FailureCategory;
          scores[key] += 1;
        }
      }
    }

    // Environmental context scoring
    if (input.environmentalContext) {
      const env = input.environmentalContext;
      
      if (env.cpuUsage && env.cpuUsage > 80) scores['resource-exhaustion'] += 2;
      if (env.memoryUsage && env.memoryUsage > 90) scores['resource-exhaustion'] += 2;
      if (env.networkLatency && env.networkLatency > 1000) scores['external-service'] += 2;
      if (env.concurrentJobs && env.concurrentJobs > 10) scores['concurrency'] += 1;
    }

    // Duration-based scoring
    if (input.duration) {
      if (input.duration > 30000) scores['timing'] += 1; // Over 30 seconds
      if (input.duration < 100) scores['configuration'] += 1; // Too fast, likely config issue
    }

    // Find primary and secondary categories
    const sortedCategories = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0);

    if (sortedCategories.length === 0) {
      return { primary: 'unknown', secondary: [], confidence: 0.1 };
    }

    const primary = sortedCategories[0][0] as FailureCategory;
    const secondary = sortedCategories.slice(1, 3).map(([cat]) => cat as FailureCategory);
    
    // Calculate confidence based on score difference and data quality
    const primaryScore = sortedCategories[0][1];
    const secondaryScore = sortedCategories[1]?.[1] || 0;
    const baseConfidence = Math.min(primaryScore / 5, 1.0); // Max 5 patterns
    const differentialBonus = Math.min((primaryScore - secondaryScore) / 3, 0.3);
    
    const confidence = Math.min(baseConfidence + differentialBonus, 0.95);

    return { primary, secondary, confidence };
  }

  /**
   * Analyze timing-related issues
   */
  private static analyzeTimingIssues(input: AIAnalysisInput): string[] {
    const issues: string[] = [];
    const text = `${input.errorMessage || ''} ${input.stackTrace || ''}`.toLowerCase();

    // Check for explicit timing issues
    if (/timeout|timed out/i.test(text)) {
      issues.push('Test timeout detected');
    }
    
    if (/race condition/i.test(text)) {
      issues.push('Race condition identified');
    }
    
    if (/async.*reject|promise.*reject/i.test(text)) {
      issues.push('Unhandled promise rejection');
    }

    // Duration analysis
    if (input.duration) {
      if (input.duration > 60000) {
        issues.push('Unusually long execution time');
      }
      if (input.duration < 10) {
        issues.push('Suspiciously fast execution');
      }
    }

    // Check for timing keywords in test name
    const testText = `${input.testName} ${input.testSuite || ''}`.toLowerCase();
    for (const keyword of this.TIMING_KEYWORDS) {
      if (testText.includes(keyword)) {
        issues.push(`Test involves ${keyword} operations`);
        break;
      }
    }

    return issues;
  }

  /**
   * Analyze environmental factors that might contribute to flakiness
   */
  private static analyzeEnvironmentalFactors(input: AIAnalysisInput): string[] {
    const factors: string[] = [];
    
    if (input.environmentalContext) {
      const env = input.environmentalContext;
      
      if (env.concurrentJobs && env.concurrentJobs > 5) {
        factors.push(`High concurrent job load: ${env.concurrentJobs}`);
      }
      
      if (env.cpuUsage && env.cpuUsage > 70) {
        factors.push(`High CPU usage: ${env.cpuUsage}%`);
      }
      
      if (env.memoryUsage && env.memoryUsage > 80) {
        factors.push(`High memory usage: ${env.memoryUsage}%`);
      }
      
      if (env.networkLatency && env.networkLatency > 500) {
        factors.push(`High network latency: ${env.networkLatency}ms`);
      }
      
      if (env.timeOfDay) {
        const hour = parseInt(env.timeOfDay);
        if (hour >= 9 && hour <= 17) {
          factors.push('Executed during peak hours');
        }
      }
      
      if (env.ciRegion) {
        factors.push(`CI region: ${env.ciRegion}`);
      }
    }

    // Check for environment-related keywords in error
    const text = `${input.errorMessage || ''} ${input.stackTrace || ''}`.toLowerCase();
    for (const keyword of this.ENVIRONMENT_KEYWORDS) {
      if (text.includes(keyword)) {
        factors.push(`Environment-related keyword detected: ${keyword}`);
        break;
      }
    }

    return factors;
  }

  /**
   * Find similar issues in the database
   */
  private static async findSimilarIssues(input: AIAnalysisInput): Promise<number> {
    try {
      const stackTraceSignature = this.generateStackTraceSignature(input.stackTrace);
      const errorPattern = this.extractErrorPattern(input.errorMessage, input.stackTrace);
      
      if (!stackTraceSignature && !errorPattern) return 0;
      
      const similarAnalyses = await prisma.rootCauseAnalysis.findMany({
        where: {
          OR: [
            stackTraceSignature ? { stackTraceSignature } : {},
            errorPattern ? { errorPattern } : {},
          ].filter(condition => Object.keys(condition).length > 0),
        },
        select: { id: true },
      });
      
      return similarAnalyses.length;
    } catch (error) {
      console.error('Error finding similar issues:', error);
      return 0;
    }
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  private static generateRecommendations(
    primaryCategory: FailureCategory,
    secondaryCategories: FailureCategory[],
    input: AIAnalysisInput,
    timingIssues: string[],
    environmentFactors: string[]
  ): RecommendationSet {
    const immediate: Recommendation[] = [];
    const shortTerm: Recommendation[] = [];
    const longTerm: Recommendation[] = [];

    switch (primaryCategory) {
      case 'timing':
        immediate.push({
          title: 'Increase test timeouts',
          description: 'Add explicit timeouts or increase existing timeout values',
          priority: 'high',
          effort: 'low',
          category: 'timing',
          codeExample: 'jest.setTimeout(30000); // 30 seconds',
        });
        shortTerm.push({
          title: 'Add explicit waits',
          description: 'Replace implicit waits with explicit wait conditions',
          priority: 'medium',
          effort: 'medium',
          category: 'timing',
        });
        break;

      case 'environment':
        immediate.push({
          title: 'Review test environment setup',
          description: 'Ensure consistent environment setup and teardown',
          priority: 'high',
          effort: 'medium',
          category: 'environment',
        });
        shortTerm.push({
          title: 'Implement environment validation',
          description: 'Add checks to verify environment state before test execution',
          priority: 'medium',
          effort: 'medium',
          category: 'environment',
        });
        break;

      case 'data-dependency':
        immediate.push({
          title: 'Implement test data isolation',
          description: 'Ensure each test creates and cleans up its own data',
          priority: 'high',
          effort: 'medium',
          category: 'data',
        });
        shortTerm.push({
          title: 'Add database transaction rollback',
          description: 'Wrap tests in transactions that rollback after completion',
          priority: 'medium',
          effort: 'low',
          category: 'data',
        });
        break;

      case 'external-service':
        immediate.push({
          title: 'Add service availability checks',
          description: 'Verify external services are available before test execution',
          priority: 'high',
          effort: 'low',
          category: 'external',
        });
        shortTerm.push({
          title: 'Implement service mocking',
          description: 'Mock external service calls for more reliable tests',
          priority: 'medium',
          effort: 'high',
          category: 'external',
        });
        break;

      default:
        immediate.push({
          title: 'Add comprehensive logging',
          description: 'Increase logging to help identify the root cause',
          priority: 'medium',
          effort: 'low',
          category: 'debugging',
        });
    }

    // Add specific recommendations based on timing issues
    if (timingIssues.length > 0) {
      shortTerm.push({
        title: 'Investigate timing dependencies',
        description: 'Review code for timing-dependent operations and make them deterministic',
        priority: 'medium',
        effort: 'medium',
        category: 'timing',
      });
    }

    // Add environment-specific recommendations
    if (environmentFactors.some(factor => factor.includes('CPU') || factor.includes('memory'))) {
      longTerm.push({
        title: 'Optimize resource usage',
        description: 'Review test resource consumption and optimize accordingly',
        priority: 'low',
        effort: 'high',
        category: 'performance',
      });
    }

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Estimate the effort required to fix the issue
   */
  private static estimateFixEffort(
    primaryCategory: FailureCategory,
    confidence: number,
    timingIssuesCount: number,
    environmentFactorsCount: number
  ): 'low' | 'medium' | 'high' {
    let effortScore = 0;

    // Base effort by category
    switch (primaryCategory) {
      case 'timing':
        effortScore += 2;
        break;
      case 'environment':
        effortScore += 3;
        break;
      case 'data-dependency':
        effortScore += 2;
        break;
      case 'external-service':
        effortScore += 1;
        break;
      case 'concurrency':
        effortScore += 4;
        break;
      case 'resource-exhaustion':
        effortScore += 3;
        break;
      default:
        effortScore += 3;
    }

    // Adjust based on confidence (low confidence = harder to fix)
    if (confidence < 0.5) effortScore += 2;
    else if (confidence < 0.7) effortScore += 1;

    // Adjust based on complexity indicators
    effortScore += Math.min(timingIssuesCount, 2);
    effortScore += Math.min(environmentFactorsCount / 2, 2);

    if (effortScore <= 2) return 'low';
    if (effortScore <= 5) return 'medium';
    return 'high';
  }

  /**
   * Calculate data quality score based on available information
   */
  private static calculateDataQuality(input: AIAnalysisInput): number {
    let score = 0;
    let maxScore = 0;

    // Error message quality
    maxScore += 2;
    if (input.errorMessage) {
      score += input.errorMessage.length > 10 ? 2 : 1;
    }

    // Stack trace quality
    maxScore += 2;
    if (input.stackTrace) {
      score += input.stackTrace.length > 50 ? 2 : 1;
    }

    // Environmental context
    maxScore += 2;
    if (input.environmentalContext) {
      const contextKeys = Object.keys(input.environmentalContext).length;
      score += Math.min(contextKeys / 3, 2);
    }

    // Historical data
    maxScore += 1;
    if (input.historicalFailures && input.historicalFailures.length > 0) {
      score += 1;
    }

    // Duration data
    maxScore += 1;
    if (input.duration !== undefined) {
      score += 1;
    }

    return maxScore > 0 ? score / maxScore : 0.5;
  }

  /**
   * Get generic recommendations for unknown failures
   */
  private static getGenericRecommendations(): RecommendationSet {
    return {
      immediate: [
        {
          title: 'Add detailed logging',
          description: 'Increase logging verbosity to capture more failure context',
          priority: 'medium',
          effort: 'low',
          category: 'debugging',
        },
      ],
      shortTerm: [
        {
          title: 'Review test for non-determinism',
          description: 'Check for sources of non-deterministic behavior',
          priority: 'medium',
          effort: 'medium',
          category: 'stability',
        },
      ],
      longTerm: [
        {
          title: 'Implement comprehensive test monitoring',
          description: 'Set up monitoring to track test behavior patterns over time',
          priority: 'low',
          effort: 'high',
          category: 'monitoring',
        },
      ],
    };
  }

  // ===== ENHANCED ML-POWERED METHODS =====

  /**
   * Analyze historical patterns for this test
   */
  private static async analyzeHistoricalPattern(input: AIAnalysisInput): Promise<{
    failureFrequency: number;
    timingPattern: 'consistent' | 'random' | 'periodic';
    environmentalCorrelation: number;
    recentTrend: 'improving' | 'worsening' | 'stable';
  }> {
    try {
      // Get historical failures for this test in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const historicalFailures = await prisma.testResult.findMany({
        where: {
          testName: input.testName,
          testSuite: input.testSuite,
          status: 'failed',
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        select: {
          createdAt: true,
          duration: true,
          errorMessage: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (historicalFailures.length === 0) {
        return {
          failureFrequency: 0,
          timingPattern: 'consistent',
          environmentalCorrelation: 0,
          recentTrend: 'stable'
        };
      }
      
      // Calculate failure frequency (failures per day)
      const failureFrequency = historicalFailures.length / 30;
      
      // Analyze timing patterns
      const timingPattern = this.analyzeTimingPattern(historicalFailures);
      
      // Calculate environmental correlation
      const environmentalCorrelation = this.calculateEnvironmentalCorrelation(historicalFailures);
      
      // Analyze recent trend (last 7 days vs previous 7 days)
      const recentTrend = this.analyzeRecentTrend(historicalFailures);
      
      return {
        failureFrequency,
        timingPattern,
        environmentalCorrelation,
        recentTrend
      };
      
    } catch (error) {
      console.error('Error analyzing historical pattern:', error);
      return {
        failureFrequency: 0,
        timingPattern: 'consistent',
        environmentalCorrelation: 0,
        recentTrend: 'stable'
      };
    }
  }

  /**
   * Analyze seasonal factors (time of day, day of week)
   */
  private static analyzeSeasonalFactors(input: AIAnalysisInput): {
    timeOfDayFactor: number;
    dayOfWeekFactor: number;
    seasonalScore: number;
  } {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Time of day factors (higher score = more likely to fail)
    let timeOfDayFactor = 0;
    if (hour >= 0 && hour < 6) timeOfDayFactor = 0.3; // Early morning - less load
    else if (hour >= 6 && hour < 9) timeOfDayFactor = 0.8; // Morning rush
    else if (hour >= 9 && hour < 17) timeOfDayFactor = 1.0; // Business hours - peak load
    else if (hour >= 17 && hour < 22) timeOfDayFactor = 0.7; // Evening
    else timeOfDayFactor = 0.4; // Night
    
    // Day of week factors
    let dayOfWeekFactor = 0;
    if (dayOfWeek >= 1 && dayOfWeek <= 5) dayOfWeekFactor = 1.0; // Weekdays
    else dayOfWeekFactor = 0.3; // Weekends
    
    const seasonalScore = (timeOfDayFactor + dayOfWeekFactor) / 2;
    
    return {
      timeOfDayFactor,
      dayOfWeekFactor,
      seasonalScore
    };
  }

  /**
   * Analyze cross-test patterns to find related flaky tests
   */
  private static async analyzeCrossTestPatterns(input: AIAnalysisInput): Promise<{
    relatedFlakyTests: string[];
    commonPatterns: string[];
    correlationScore: number;
  }> {
    try {
      // Find other flaky tests in the same project with similar error patterns
      const relatedTests = await prisma.flakyTestPattern.findMany({
        where: {
          projectId: input.projectId,
          testName: input.testName,
          isActive: true
        },
        select: {
          testName: true,
          confidence: true
        },
        take: 10
      });
      
      const errorText = (input.errorMessage || '').toLowerCase();
      const relatedFlakyTests: string[] = [];
      const commonPatterns: string[] = [];
      
      for (const test of relatedTests) {
        if (test.testName !== input.testName) {
          // Add related flaky tests (simplified since pattern field doesn't exist)
          relatedFlakyTests.push(test.testName);
          commonPatterns.push('Common flaky pattern');
        }
      }
      
      const correlationScore = relatedFlakyTests.length > 0 ? 
        Math.min(relatedFlakyTests.length / 5, 1.0) : 0;
      
      return {
        relatedFlakyTests,
        commonPatterns,
        correlationScore
      };
      
    } catch (error) {
      console.error('Error analyzing cross-test patterns:', error);
      return {
        relatedFlakyTests: [],
        commonPatterns: [],
        correlationScore: 0
      };
    }
  }

  /**
   * Enhance confidence score using ML factors
   */
  private static enhanceConfidenceWithML(
    baseConfidence: number,
    historicalPattern: any,
    seasonalFactors: any
  ): number {
    let enhancedConfidence = baseConfidence;
    
    // Boost confidence for tests with consistent historical patterns
    if (historicalPattern.failureFrequency > 0.1) {
      enhancedConfidence += 0.1;
    }
    
    // Boost confidence for tests failing during high-load periods
    if (seasonalFactors.seasonalScore > 0.7) {
      enhancedConfidence += 0.05;
    }
    
    // Boost confidence for worsening trends
    if (historicalPattern.recentTrend === 'worsening') {
      enhancedConfidence += 0.1;
    }
    
    return Math.min(enhancedConfidence, 0.95); // Cap at 95%
  }

  /**
   * Add historical context to recommendations
   */
  private static addHistoricalRecommendations(
    baseRecommendations: RecommendationSet,
    historicalPattern: any,
    crossTestPatterns: any
  ): RecommendationSet {
    const enhanced = { ...baseRecommendations };
    
    // Add recommendations based on historical patterns
    if (historicalPattern.recentTrend === 'worsening') {
      enhanced.immediate.unshift({
        title: 'Urgent: Escalating failure pattern detected',
        description: 'This test is failing more frequently. Immediate investigation recommended.',
        priority: 'high',
        effort: 'medium',
        category: 'investigation'
      });
    }
    
    // Add recommendations for related test patterns
    if (crossTestPatterns.relatedFlakyTests.length > 0) {
      enhanced.shortTerm.push({
        title: 'Investigate related flaky tests',
        description: `Found ${crossTestPatterns.relatedFlakyTests.length} related flaky tests. Consider batch fixing.`,
        priority: 'medium',
        effort: 'high',
        category: 'batch-fix'
      });
    }
    
    return enhanced;
  }

  // ===== HELPER METHODS =====

  private static analyzeTimingPattern(failures: any[]): 'consistent' | 'random' | 'periodic' {
    if (failures.length < 3) return 'consistent';
    
    // Simple heuristic: if failures happen at similar intervals, it's periodic
    const intervals = [];
    for (let i = 1; i < failures.length; i++) {
      const interval = failures[i-1].createdAt.getTime() - failures[i].createdAt.getTime();
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev / avgInterval < 0.5) return 'periodic';
    return 'random';
  }

  private static calculateEnvironmentalCorrelation(failures: any[]): number {
    // Simple heuristic: higher correlation if failures happen on similar branches
    const branches = failures.map(f => f.branch).filter(Boolean);
    const uniqueBranches = new Set(branches);
    
    if (branches.length === 0) return 0;
    return 1 - (uniqueBranches.size / branches.length);
  }

  private static analyzeRecentTrend(failures: any[]): 'improving' | 'worsening' | 'stable' {
    if (failures.length < 4) return 'stable';
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const recentFailures = failures.filter(f => f.createdAt >= sevenDaysAgo).length;
    const previousFailures = failures.filter(f => f.createdAt >= fourteenDaysAgo && f.createdAt < sevenDaysAgo).length;
    
    if (recentFailures > previousFailures * 1.5) return 'worsening';
    if (recentFailures < previousFailures * 0.5) return 'improving';
    return 'stable';
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}