import { prisma } from './database.service';
import { QuarantineService, QuarantineEvaluationData, QuarantineDecision } from './quarantine.service';

export interface QuarantinePolicyConfig {
  // Basic thresholds
  failureRateThreshold: number;
  confidenceThreshold: number;
  consecutiveFailures: number;
  minRunsRequired: number;
  
  // Auto-unquarantine settings
  stabilityPeriod: number;
  successRateRequired: number;
  minSuccessfulRuns: number;
  
  // High impact configuration
  highImpactSuites: string[];
  priorityTests: string[];
  
  // Advanced rules
  enableRapidDegradation: boolean;
  enableCriticalPathProtection: boolean;
  enableTimeBasedRules: boolean;
  
  // Quarantine limits
  maxQuarantinePeriod?: number; // Days
  maxQuarantinePercentage?: number; // % of total tests
}

export interface PolicyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PolicyImpactSimulation {
  wouldQuarantine: number;
  wouldUnquarantine: number;
  estimatedSavings: {
    ciMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  potentialRisks: {
    falsePositives: number;
    overQuarantine: boolean;
    criticalTestsAffected: number;
  };
}

export class QuarantinePolicyService {
  /**
   * Create or update quarantine policy for a project
   */
  static async createOrUpdatePolicy(
    projectId: string,
    name: string,
    config: QuarantinePolicyConfig,
    description?: string,
    userId?: string
  ): Promise<string> {
    // Validate the policy configuration
    const validation = this.validatePolicyConfig(config);
    if (!validation.isValid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if a policy with this name already exists
    const existingPolicy = await prisma.quarantinePolicy.findFirst({
      where: {
        projectId,
        name,
      },
    });

    if (existingPolicy) {
      // Update existing policy
      const updatedPolicy = await prisma.quarantinePolicy.update({
        where: { id: existingPolicy.id },
        data: {
          description,
          failureRateThreshold: config.failureRateThreshold,
          confidenceThreshold: config.confidenceThreshold,
          consecutiveFailures: config.consecutiveFailures,
          minRunsRequired: config.minRunsRequired,
          stabilityPeriod: config.stabilityPeriod,
          successRateRequired: config.successRateRequired,
          minSuccessfulRuns: config.minSuccessfulRuns,
          highImpactSuites: config.highImpactSuites,
          priorityTests: config.priorityTests,
          updatedAt: new Date(),
        },
      });
      return updatedPolicy.id;
    } else {
      // Create new policy
      const newPolicy = await prisma.quarantinePolicy.create({
        data: {
          projectId,
          name,
          description,
          failureRateThreshold: config.failureRateThreshold,
          confidenceThreshold: config.confidenceThreshold,
          consecutiveFailures: config.consecutiveFailures,
          minRunsRequired: config.minRunsRequired,
          stabilityPeriod: config.stabilityPeriod,
          successRateRequired: config.successRateRequired,
          minSuccessfulRuns: config.minSuccessfulRuns,
          highImpactSuites: config.highImpactSuites,
          priorityTests: config.priorityTests,
        },
      });
      return newPolicy.id;
    }
  }

  /**
   * Get all policies for a project
   */
  static async getProjectPolicies(projectId: string): Promise<any[]> {
    return await prisma.quarantinePolicy.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active policy for a project
   */
  static async getActivePolicy(projectId: string): Promise<any | null> {
    return await prisma.quarantinePolicy.findFirst({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Activate/deactivate a policy
   */
  static async setPolicyStatus(policyId: string, isActive: boolean): Promise<void> {
    await prisma.quarantinePolicy.update({
      where: { id: policyId },
      data: { 
        isActive,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a policy
   */
  static async deletePolicy(policyId: string): Promise<void> {
    await prisma.quarantinePolicy.delete({
      where: { id: policyId },
    });
  }

  /**
   * Validate policy configuration
   */
  static validatePolicyConfig(config: QuarantinePolicyConfig): PolicyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate thresholds
    if (config.failureRateThreshold < 0 || config.failureRateThreshold > 1) {
      errors.push('Failure rate threshold must be between 0 and 1');
    }
    if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }
    if (config.successRateRequired < 0 || config.successRateRequired > 1) {
      errors.push('Success rate required must be between 0 and 1');
    }

    // Validate counts
    if (config.consecutiveFailures < 1) {
      errors.push('Consecutive failures must be at least 1');
    }
    if (config.minRunsRequired < 1) {
      errors.push('Minimum runs required must be at least 1');
    }
    if (config.minSuccessfulRuns < 1) {
      errors.push('Minimum successful runs must be at least 1');
    }
    if (config.stabilityPeriod < 1) {
      errors.push('Stability period must be at least 1 day');
    }

    // Validate logical consistency
    if (config.failureRateThreshold < 0.1) {
      warnings.push('Very low failure rate threshold may cause excessive quarantining');
    }
    if (config.failureRateThreshold > 0.8) {
      warnings.push('High failure rate threshold may not catch flaky tests early enough');
    }
    if (config.confidenceThreshold < 0.5) {
      warnings.push('Low confidence threshold may result in false positives');
    }
    if (config.stabilityPeriod > 30) {
      warnings.push('Long stability period may keep good tests quarantined too long');
    }
    if (config.successRateRequired < 0.8) {
      warnings.push('Low success rate for unquarantine may release unstable tests');
    }

    // Validate limits
    if (config.maxQuarantinePercentage && config.maxQuarantinePercentage > 50) {
      warnings.push('High quarantine percentage limit may affect too many tests');
    }
    if (config.maxQuarantinePeriod && config.maxQuarantinePeriod > 90) {
      warnings.push('Very long maximum quarantine period may be excessive');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Simulate policy impact on existing test data
   */
  static async simulatePolicyImpact(
    projectId: string,
    config: QuarantinePolicyConfig
  ): Promise<PolicyImpactSimulation> {
    // Get all flaky test patterns for the project
    const flakyTests = await prisma.flakyTestPattern.findMany({
      where: { projectId },
      include: {
        rootCauseAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let wouldQuarantine = 0;
    let wouldUnquarantine = 0;
    let estimatedCiMinutes = 0;
    let estimatedDeveloperHours = 0;
    let estimatedBuildsProtected = 0;
    let falsePositives = 0;
    let criticalTestsAffected = 0;

    // Simulate quarantine decisions for each test
    for (const test of flakyTests) {
      const isHighImpact = this.isHighImpactTest(test, config);
      const isCritical = config.priorityTests.includes(test.testName);

      // Get recent test results for consecutive failure calculation
      const recentResults = await prisma.testResult.findMany({
        where: {
          testName: test.testName,
          testSuite: test.testSuite,
          testRun: { projectId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const consecutiveFailures = this.calculateConsecutiveFailures(recentResults);

      const evaluationData: QuarantineEvaluationData = {
        testName: test.testName,
        testSuite: test.testSuite || undefined,
        projectId,
        failureRate: test.failureRate,
        confidence: test.confidence,
        totalRuns: test.totalRuns,
        failedRuns: test.failedRuns,
        consecutiveFailures,
        recentFailures: recentResults.filter(r => r.status === 'failed'),
        isHighImpact,
      };

      // Simulate quarantine decision with the new policy
      const decision = await this.simulateQuarantineDecision(evaluationData, config);

      if (decision.shouldQuarantine && !test.isQuarantined) {
        wouldQuarantine++;
        
        // Estimate savings (simplified calculation)
        estimatedCiMinutes += test.failureRate * 30; // Assume 30 min per failure
        estimatedDeveloperHours += test.failureRate * 2; // Assume 2 hours debugging per failure
        estimatedBuildsProtected += Math.floor(test.failureRate * 10); // Estimate builds protected

        if (isCritical) {
          criticalTestsAffected++;
        }

        // Estimate false positives (tests with low actual flakiness)
        if (test.failureRate < 0.3 && test.confidence < 0.7) {
          falsePositives++;
        }
      } else if (!decision.shouldQuarantine && test.isQuarantined) {
        wouldUnquarantine++;
      }
    }

    const totalTests = flakyTests.length;
    const overQuarantine = totalTests > 0 && 
      (wouldQuarantine / totalTests) > (config.maxQuarantinePercentage || 50) / 100;

    return {
      wouldQuarantine,
      wouldUnquarantine,
      estimatedSavings: {
        ciMinutes: estimatedCiMinutes,
        developerHours: estimatedDeveloperHours,
        buildsProtected: estimatedBuildsProtected,
      },
      potentialRisks: {
        falsePositives,
        overQuarantine,
        criticalTestsAffected,
      },
    };
  }

  /**
   * Get recommended policy settings based on project data
   */
  static async getRecommendedPolicy(projectId: string): Promise<QuarantinePolicyConfig> {
    // Analyze project's test patterns
    const flakyTests = await prisma.flakyTestPattern.findMany({
      where: { projectId },
    });

    if (flakyTests.length === 0) {
      // Return conservative defaults for new projects
      return this.getDefaultPolicyConfig();
    }

    // Calculate statistics
    const failureRates = flakyTests.map(t => t.failureRate);
    const confidenceScores = flakyTests.map(t => t.confidence);
    
    const avgFailureRate = failureRates.reduce((a, b) => a + b, 0) / failureRates.length;
    const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    
    // Adjust thresholds based on project characteristics
    const failureRateThreshold = Math.max(0.3, avgFailureRate * 1.2);
    const confidenceThreshold = Math.max(0.6, avgConfidence * 0.9);

    // Detect common test suite patterns
    const testSuites = flakyTests
      .map(t => t.testSuite)
      .filter(Boolean)
      .reduce((acc, suite) => {
        acc[suite!] = (acc[suite!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const highImpactSuites = Object.entries(testSuites)
      .filter(([_, count]) => count >= 3) // Suites with 3+ flaky tests
      .map(([suite]) => suite);

    return {
      failureRateThreshold: Math.min(failureRateThreshold, 0.7),
      confidenceThreshold: Math.min(confidenceThreshold, 0.8),
      consecutiveFailures: 3,
      minRunsRequired: 5,
      stabilityPeriod: 7,
      successRateRequired: 0.95,
      minSuccessfulRuns: 10,
      highImpactSuites,
      priorityTests: [],
      enableRapidDegradation: true,
      enableCriticalPathProtection: true,
      enableTimeBasedRules: false,
      maxQuarantinePeriod: 30,
      maxQuarantinePercentage: 25,
    };
  }

  /**
   * Apply policy to evaluate a test for quarantine
   */
  static async applyPolicyToTest(
    projectId: string,
    evaluationData: QuarantineEvaluationData
  ): Promise<QuarantineDecision> {
    const activePolicy = await this.getActivePolicy(projectId);
    
    if (!activePolicy) {
      // Use default rules if no policy is configured
      return await QuarantineService.evaluateQuarantine(evaluationData);
    }

    // Apply policy-specific rules
    return await this.simulateQuarantineDecision(evaluationData, {
      failureRateThreshold: activePolicy.failureRateThreshold,
      confidenceThreshold: activePolicy.confidenceThreshold,
      consecutiveFailures: activePolicy.consecutiveFailures,
      minRunsRequired: activePolicy.minRunsRequired,
      stabilityPeriod: activePolicy.stabilityPeriod,
      successRateRequired: activePolicy.successRateRequired,
      minSuccessfulRuns: activePolicy.minSuccessfulRuns,
      highImpactSuites: activePolicy.highImpactSuites,
      priorityTests: activePolicy.priorityTests,
      enableRapidDegradation: true,
      enableCriticalPathProtection: true,
      enableTimeBasedRules: false,
    });
  }

  /**
   * Get default policy configuration
   */
  private static getDefaultPolicyConfig(): QuarantinePolicyConfig {
    return {
      failureRateThreshold: 0.5,
      confidenceThreshold: 0.7,
      consecutiveFailures: 3,
      minRunsRequired: 5,
      stabilityPeriod: 7,
      successRateRequired: 0.95,
      minSuccessfulRuns: 10,
      highImpactSuites: [],
      priorityTests: [],
      enableRapidDegradation: true,
      enableCriticalPathProtection: true,
      enableTimeBasedRules: false,
      maxQuarantinePeriod: 30,
      maxQuarantinePercentage: 25,
    };
  }

  /**
   * Check if a test is considered high impact
   */
  private static isHighImpactTest(test: any, config: QuarantinePolicyConfig): boolean {
    // Check if test suite is in high impact list
    if (test.testSuite && config.highImpactSuites.includes(test.testSuite)) {
      return true;
    }

    // Check if test name is in priority list
    if (config.priorityTests.includes(test.testName)) {
      return true;
    }

    // Check for high impact indicators in test name
    const highImpactKeywords = ['critical', 'smoke', 'integration', 'e2e', 'sanity'];
    const testNameLower = test.testName.toLowerCase();
    
    return highImpactKeywords.some(keyword => testNameLower.includes(keyword));
  }

  /**
   * Calculate consecutive failures from recent results
   */
  private static calculateConsecutiveFailures(results: any[]): number {
    let consecutive = 0;
    for (const result of results) {
      if (result.status === 'failed') {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  /**
   * Simulate quarantine decision with specific policy config
   */
  private static async simulateQuarantineDecision(
    data: QuarantineEvaluationData,
    config: QuarantinePolicyConfig
  ): Promise<QuarantineDecision> {
    // Policy-based evaluation logic
    const meetsFailureRate = data.failureRate >= config.failureRateThreshold;
    const meetsConfidence = data.confidence >= config.confidenceThreshold;
    const meetsMinRuns = data.totalRuns >= config.minRunsRequired;
    const meetsConsecutiveFailures = data.consecutiveFailures >= config.consecutiveFailures;

    // High impact boost
    const isHighImpact = config.highImpactSuites.includes(data.testSuite || '') ||
                        config.priorityTests.includes(data.testName);
    
    const impactMultiplier = isHighImpact ? 1.5 : 1.0;
    const adjustedFailureThreshold = config.failureRateThreshold / impactMultiplier;

    const shouldQuarantine = meetsMinRuns && meetsConfidence && 
                           (meetsFailureRate || data.failureRate >= adjustedFailureThreshold || 
                            meetsConsecutiveFailures);

    const confidence = Math.min(
      data.confidence * (shouldQuarantine ? 1.2 : 0.8),
      1.0
    );

    const reason = shouldQuarantine ?
      `Policy-based quarantine: ${data.failureRate >= config.failureRateThreshold ? 'failure rate' : 'consecutive failures'} threshold exceeded` :
      'Policy criteria not met';

    return {
      shouldQuarantine,
      reason,
      confidence,
      impactScore: data.failureRate * impactMultiplier,
      triggeredBy: 'policy',
      metadata: {
        policyBased: true,
        thresholds: {
          failureRate: config.failureRateThreshold,
          confidence: config.confidenceThreshold,
          consecutiveFailures: config.consecutiveFailures,
        },
        actualValues: {
          failureRate: data.failureRate,
          confidence: data.confidence,
          consecutiveFailures: data.consecutiveFailures,
        },
        isHighImpact,
      },
    };
  }
}