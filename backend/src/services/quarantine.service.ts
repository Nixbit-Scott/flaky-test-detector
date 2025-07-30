import { prisma } from './database.service';

export interface QuarantineDecision {
  shouldQuarantine: boolean;
  reason: string;
  confidence: number;
  impactScore: number;
  triggeredBy: string;
  metadata?: Record<string, any>;
}

export interface UnquarantineDecision {
  shouldUnquarantine: boolean;
  reason: string;
  stabilityScore: number;
  consecutiveSuccesses: number;
  daysSinceQuarantine: number;
}

export interface QuarantineRule {
  name: string;
  description: string;
  priority: number;
  evaluate: (data: QuarantineEvaluationData) => QuarantineDecision;
}

export interface QuarantineEvaluationData {
  testName: string;
  testSuite?: string;
  projectId: string;
  failureRate: number;
  confidence: number;
  totalRuns: number;
  failedRuns: number;
  consecutiveFailures: number;
  recentFailures: any[];
  lastFailure?: Date;
  isHighImpact?: boolean;
  ciProvider?: string;
  branch?: string;
}

export interface QuarantineStats {
  totalQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  quarantineSavings: {
    ciTimeMinutes: number;
    developerHours: number;
    buildsProtected: number;
  };
  avgQuarantineDays: number;
  falsePositiveRate: number;
}

export class QuarantineService {
  private static readonly NOTIFICATION_SERVICE = require('./notification.service').NotificationService;
  private static readonly DEFAULT_RULES: QuarantineRule[] = [
    {
      name: 'High Failure Rate',
      description: 'Quarantine tests with consistently high failure rates',
      priority: 1,
      evaluate: (data) => {
        const shouldQuarantine = data.failureRate >= 0.6 && 
                                data.confidence >= 0.7 && 
                                data.totalRuns >= 5;
        return {
          shouldQuarantine,
          reason: shouldQuarantine ? 
            `High failure rate: ${(data.failureRate * 100).toFixed(1)}% (${data.failedRuns}/${data.totalRuns} runs)` :
            'Failure rate below threshold',
          confidence: data.confidence,
          impactScore: data.failureRate * (data.isHighImpact ? 2 : 1),
          triggeredBy: 'auto',
          metadata: {
            rule: 'high_failure_rate',
            failureRate: data.failureRate,
            totalRuns: data.totalRuns,
            failedRuns: data.failedRuns,
          },
        };
      },
    },
    {
      name: 'Consecutive Failures',
      description: 'Quarantine tests with multiple consecutive failures',
      priority: 2,
      evaluate: (data) => {
        const shouldQuarantine = data.consecutiveFailures >= 3 && 
                                data.confidence >= 0.6;
        return {
          shouldQuarantine,
          reason: shouldQuarantine ? 
            `${data.consecutiveFailures} consecutive failures detected` :
            'Not enough consecutive failures',
          confidence: Math.min(data.confidence + (data.consecutiveFailures * 0.1), 1.0),
          impactScore: data.consecutiveFailures * 0.3 * (data.isHighImpact ? 1.5 : 1),
          triggeredBy: 'auto',
          metadata: {
            rule: 'consecutive_failures',
            consecutiveFailures: data.consecutiveFailures,
          },
        };
      },
    },
    {
      name: 'Critical Path Impact',
      description: 'Quarantine high-impact tests that block critical pipelines',
      priority: 3,
      evaluate: (data) => {
        const shouldQuarantine = Boolean(data.isHighImpact) && 
                                data.failureRate >= 0.4 && 
                                data.confidence >= 0.5;
        return {
          shouldQuarantine,
          reason: shouldQuarantine ? 
            'High-impact test affecting critical pipelines' :
            'Not a critical path blocker',
          confidence: data.confidence * (Boolean(data.isHighImpact) ? 1.2 : 1),
          impactScore: data.failureRate * 3, // High impact multiplier
          triggeredBy: 'auto',
          metadata: {
            rule: 'critical_path_impact',
            isHighImpact: data.isHighImpact,
            branch: data.branch,
          },
        };
      },
    },
    {
      name: 'Rapid Degradation',
      description: 'Quarantine tests showing rapid quality degradation',
      priority: 4,
      evaluate: (data) => {
        // Check if recent failures are increasing
        const recentFailureRate = data.recentFailures.length > 0 ? 
          data.recentFailures.filter(f => f.status === 'failed').length / data.recentFailures.length : 0;
        
        const shouldQuarantine = recentFailureRate > data.failureRate * 1.5 && 
                                data.recentFailures.length >= 3 &&
                                data.confidence >= 0.5;
        
        return {
          shouldQuarantine,
          reason: shouldQuarantine ? 
            `Rapid degradation: recent failure rate ${(recentFailureRate * 100).toFixed(1)}% vs overall ${(data.failureRate * 100).toFixed(1)}%` :
            'No rapid degradation detected',
          confidence: data.confidence,
          impactScore: recentFailureRate * 1.5,
          triggeredBy: 'auto',
          metadata: {
            rule: 'rapid_degradation',
            recentFailureRate,
            overallFailureRate: data.failureRate,
            recentSamples: data.recentFailures.length,
          },
        };
      },
    },
  ];

  /**
   * Evaluate whether a test should be quarantined
   */
  static async evaluateQuarantine(data: QuarantineEvaluationData): Promise<QuarantineDecision> {
    // Get project-specific policies
    const policies = await this.getProjectPolicies(data.projectId);
    
    // Check if test is already quarantined
    const existingPattern = await prisma.flakyTestPattern.findFirst({
      where: {
        projectId: data.projectId,
        testName: data.testName,
        testSuite: data.testSuite || null,
        isQuarantined: true,
      },
    });

    if (existingPattern) {
      return {
        shouldQuarantine: false,
        reason: 'Test already quarantined',
        confidence: 0,
        impactScore: 0,
        triggeredBy: 'existing',
      };
    }

    // Evaluate against all rules
    const decisions = this.DEFAULT_RULES.map(rule => rule.evaluate(data));
    
    // Find the highest priority rule that recommends quarantine
    const quarantineDecision = decisions
      .filter(d => d.shouldQuarantine)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (quarantineDecision) {
      return quarantineDecision;
    }

    // No rule triggered quarantine
    return {
      shouldQuarantine: false,
      reason: 'No quarantine criteria met',
      confidence: 0,
      impactScore: 0,
      triggeredBy: 'none',
    };
  }

  /**
   * Automated quarantine evaluation and execution
   */
  static async autoEvaluateAndQuarantine(
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    testResult: any
  ): Promise<{ quarantined: boolean; decision?: QuarantineDecision }> {
    try {
      // Get recent test history for evaluation
      const testHistory = await this.getTestHistory(projectId, testName, testSuite);
      
      if (testHistory.length < 3) {
        return { quarantined: false }; // Need minimum history
      }
      
      // Calculate evaluation data
      const evaluationData = await this.buildEvaluationData(
        projectId, 
        testName, 
        testSuite, 
        testHistory
      );
      
      // Evaluate quarantine decision
      const decision = await this.evaluateQuarantine(evaluationData);
      
      if (decision.shouldQuarantine) {
        await this.quarantineTest(projectId, testName, testSuite, decision);
        
        // Send notification
        await this.NOTIFICATION_SERVICE.sendQuarantineNotification({
          projectId,
          testName,
          testSuite,
          decision,
          type: 'auto_quarantine'
        });
        
        return { quarantined: true, decision };
      }
      
      return { quarantined: false, decision };
      
    } catch (error) {
      console.error('Error in auto-quarantine evaluation:', error);
      return { quarantined: false };
    }
  }

  /**
   * Automated unquarantine evaluation and execution
   */
  static async autoEvaluateUnquarantine(projectId: string): Promise<number> {
    try {
      const quarantinedTests = await this.getQuarantinedTests(projectId);
      let unquarantinedCount = 0;
      
      for (const test of quarantinedTests) {
        const decision = await this.evaluateUnquarantine(test);
        
        if (decision.shouldUnquarantine) {
          await this.unquarantineTest(test.id, decision.reason, 'auto');
          
          // Send notification
          await this.NOTIFICATION_SERVICE.sendQuarantineNotification({
            projectId,
            testName: test.testName,
            testSuite: test.testSuite,
            decision,
            type: 'auto_unquarantine'
          });
          
          unquarantinedCount++;
        }
      }
      
      return unquarantinedCount;
      
    } catch (error) {
      console.error('Error in auto-unquarantine evaluation:', error);
      return 0;
    }
  }

  /**
   * Execute quarantine action
   */
  static async quarantineTest(
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    decision: QuarantineDecision,
    userId?: string
  ): Promise<void> {
    const triggeredBy = userId || decision.triggeredBy;

    // Update the flaky test pattern
    await prisma.flakyTestPattern.updateMany({
      where: {
        projectId,
        testName,
        testSuite: testSuite || null,
      },
      data: {
        isQuarantined: true,
        quarantinedAt: new Date(),
        quarantinedBy: triggeredBy,
        quarantineReason: decision.reason,
        updatedAt: new Date(),
      },
    });

    // Record quarantine history
    const flakyPattern = await prisma.flakyTestPattern.findFirst({
      where: {
        projectId,
        testName,
        testSuite: testSuite || null,
      },
    });

    if (flakyPattern) {
      await prisma.quarantineHistory.create({
        data: {
          flakyTestPatternId: flakyPattern.id,
          action: 'quarantined',
          reason: decision.reason,
          triggeredBy,
          metadata: decision.metadata as any,
          failureRate: flakyPattern.failureRate,
          confidence: decision.confidence,
          impactScore: decision.impactScore,
        },
      });

      // Initialize quarantine impact tracking
      await prisma.quarantineImpact.upsert({
        where: {
          projectId_flakyTestPatternId: {
            projectId,
            flakyTestPatternId: flakyPattern.id,
          },
        },
        update: {
          periodStart: new Date(),
          periodEnd: null,
          autoUnquarantined: false,
          manualIntervention: false,
        },
        create: {
          projectId,
          flakyTestPatternId: flakyPattern.id,
          periodStart: new Date(),
        },
      });
    }
  }

  /**
   * Evaluate whether a quarantined test should be unquarantined
   */
  static async evaluateUnquarantine(flakyTestPatternId: string): Promise<UnquarantineDecision> {
    const pattern = await prisma.flakyTestPattern.findUnique({
      where: { id: flakyTestPatternId },
      include: {
        project: true,
      },
    });

    if (!pattern || !pattern.isQuarantined || !pattern.quarantinedAt) {
      return {
        shouldUnquarantine: false,
        reason: 'Test not quarantined',
        stabilityScore: 0,
        consecutiveSuccesses: 0,
        daysSinceQuarantine: 0,
      };
    }

    // Get recent test results since quarantine
    const recentResults = await prisma.testResult.findMany({
      where: {
        testName: pattern.testName,
        testSuite: pattern.testSuite,
        testRun: {
          projectId: pattern.projectId,
        },
        createdAt: {
          gte: pattern.quarantinedAt,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const daysSinceQuarantine = Math.floor(
      (Date.now() - pattern.quarantinedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate stability metrics
    const totalRecentRuns = recentResults.length;
    const successfulRuns = recentResults.filter(r => r.status === 'passed').length;
    const successRate = totalRecentRuns > 0 ? successfulRuns / totalRecentRuns : 0;

    // Calculate consecutive successes
    let consecutiveSuccesses = 0;
    for (const result of recentResults) {
      if (result.status === 'passed') {
        consecutiveSuccesses++;
      } else {
        break;
      }
    }

    // Get project policies for unquarantine thresholds
    const policies = await this.getProjectPolicies(pattern.projectId);
    const defaultPolicy = {
      stabilityPeriod: 7,
      successRateRequired: 0.95,
      minSuccessfulRuns: 10,
    };
    const policy = policies[0] || defaultPolicy;

    // Evaluate unquarantine criteria
    const meetsStabilityPeriod = daysSinceQuarantine >= policy.stabilityPeriod;
    const meetsSuccessRate = successRate >= policy.successRateRequired;
    const hasEnoughRuns = totalRecentRuns >= policy.minSuccessfulRuns;
    const hasConsecutiveSuccesses = consecutiveSuccesses >= Math.min(policy.minSuccessfulRuns / 2, 5);

    const stabilityScore = Math.min(
      successRate + 
      (consecutiveSuccesses / 10) + 
      (daysSinceQuarantine / policy.stabilityPeriod) * 0.2,
      1.0
    );

    const shouldUnquarantine = meetsStabilityPeriod && 
                              meetsSuccessRate && 
                              hasEnoughRuns && 
                              hasConsecutiveSuccesses;

    return {
      shouldUnquarantine,
      reason: shouldUnquarantine ? 
        `Test stabilized: ${(successRate * 100).toFixed(1)}% success rate over ${totalRecentRuns} runs` :
        `Waiting for stability: ${(successRate * 100).toFixed(1)}% success rate, ${consecutiveSuccesses} consecutive successes, ${daysSinceQuarantine}/${policy.stabilityPeriod} days`,
      stabilityScore,
      consecutiveSuccesses,
      daysSinceQuarantine,
    };
  }

  /**
   * Execute unquarantine action
   */
  static async unquarantineTest(
    flakyTestPatternId: string,
    decision: UnquarantineDecision,
    userId?: string
  ): Promise<void> {
    const triggeredBy = userId || 'auto';

    // Update the flaky test pattern
    await prisma.flakyTestPattern.update({
      where: { id: flakyTestPatternId },
      data: {
        isQuarantined: false,
        quarantinedAt: null,
        quarantinedBy: null,
        quarantineReason: null,
        updatedAt: new Date(),
      },
    });

    // Record unquarantine history
    await prisma.quarantineHistory.create({
      data: {
        flakyTestPatternId,
        action: 'unquarantined',
        reason: decision.reason,
        triggeredBy,
        metadata: {
          stabilityScore: decision.stabilityScore,
          consecutiveSuccesses: decision.consecutiveSuccesses,
          daysSinceQuarantine: decision.daysSinceQuarantine,
        } as any,
      },
    });

    // Update quarantine impact tracking
    await prisma.quarantineImpact.updateMany({
      where: {
        flakyTestPatternId,
        periodEnd: null,
      },
      data: {
        periodEnd: new Date(),
        autoUnquarantined: !userId,
        quarantinePeriod: decision.daysSinceQuarantine,
      },
    });
  }

  /**
   * Check if a test is currently quarantined
   */
  static async isTestQuarantined(
    projectId: string,
    testName: string,
    testSuite?: string
  ): Promise<boolean> {
    const pattern = await prisma.flakyTestPattern.findFirst({
      where: {
        projectId,
        testName,
        testSuite: testSuite || null,
        isQuarantined: true,
      },
    });

    return pattern !== null;
  }

  /**
   * Get quarantined tests for a project
   */
  static async getQuarantinedTests(projectId: string): Promise<any[]> {
    const quarantinedTests = await prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        isQuarantined: true,
      },
      include: {
        quarantineHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        quarantineImpacts: {
          where: { periodEnd: null },
        },
      },
      orderBy: { quarantinedAt: 'desc' },
    });

    return quarantinedTests.map(test => ({
      ...test,
      latestHistory: test.quarantineHistory[0] || null,
      currentImpact: test.quarantineImpacts[0] || null,
      quarantineDays: test.quarantinedAt ? 
        Math.floor((Date.now() - test.quarantinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    }));
  }

  /**
   * Run periodic check for auto-unquarantine
   */
  static async runPeriodicUnquarantineCheck(projectId?: string): Promise<void> {
    const whereClause = projectId ? { projectId } : {};
    
    const quarantinedTests = await prisma.flakyTestPattern.findMany({
      where: {
        ...whereClause,
        isQuarantined: true,
      },
    });

    for (const test of quarantinedTests) {
      try {
        const decision = await this.evaluateUnquarantine(test.id);
        
        if (decision.shouldUnquarantine) {
          await this.unquarantineTest(test.id, decision);
          console.log(`Auto-unquarantined test: ${test.testName} in project ${test.projectId}`);
        }
      } catch (error) {
        console.error(`Error evaluating unquarantine for test ${test.id}:`, error);
      }
    }
  }

  /**
   * Get quarantine statistics for a project
   */
  static async getQuarantineStats(projectId: string): Promise<QuarantineStats> {
    const [
      quarantinedTests,
      quarantineHistory,
      quarantineImpacts,
    ] = await Promise.all([
      prisma.flakyTestPattern.findMany({
        where: { projectId, isQuarantined: true },
      }),
      prisma.quarantineHistory.findMany({
        where: {
          flakyTestPattern: { projectId },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.quarantineImpact.findMany({
        where: { projectId },
      }),
    ]);

    const totalQuarantined = quarantineHistory.filter(h => h.action === 'quarantined').length;
    const autoQuarantined = quarantineHistory.filter(h => 
      h.action === 'quarantined' && h.triggeredBy === 'auto'
    ).length;
    const autoUnquarantined = quarantineHistory.filter(h => 
      h.action === 'unquarantined' && h.triggeredBy === 'auto'
    ).length;

    const ciTimeMinutes = quarantineImpacts.reduce((sum, impact) => sum + impact.ciTimeWasted, 0);
    const developerHours = quarantineImpacts.reduce((sum, impact) => sum + impact.developerHours, 0);
    const buildsProtected = quarantineImpacts.reduce((sum, impact) => sum + impact.buildsBlocked, 0);

    const avgQuarantineDays = quarantineImpacts.length > 0 ? 
      quarantineImpacts.reduce((sum, impact) => sum + impact.quarantinePeriod, 0) / quarantineImpacts.length :
      0;

    const falsePositives = quarantineImpacts.filter(impact => impact.falsePositives > 0).length;
    const falsePositiveRate = totalQuarantined > 0 ? falsePositives / totalQuarantined : 0;

    return {
      totalQuarantined,
      autoQuarantined,
      manualQuarantined: totalQuarantined - autoQuarantined,
      autoUnquarantined,
      quarantineSavings: {
        ciTimeMinutes,
        developerHours,
        buildsProtected,
      },
      avgQuarantineDays,
      falsePositiveRate,
    };
  }

  /**
   * Get project-specific quarantine policies
   */
  private static async getProjectPolicies(projectId: string): Promise<any[]> {
    const policies = await prisma.quarantinePolicy.findMany({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return policies;
  }

  /**
   * Create default quarantine policy for a project
   */
  static async createDefaultPolicy(projectId: string): Promise<void> {
    const existingPolicy = await prisma.quarantinePolicy.findFirst({
      where: { projectId },
    });

    if (!existingPolicy) {
      await prisma.quarantinePolicy.create({
        data: {
          projectId,
          name: 'Default Quarantine Policy',
          description: 'Auto-generated default policy for intelligent test quarantine',
          failureRateThreshold: 0.5,
          confidenceThreshold: 0.7,
          consecutiveFailures: 3,
          minRunsRequired: 5,
          stabilityPeriod: 7,
          successRateRequired: 0.95,
          minSuccessfulRuns: 10,
        },
      });
    }
  }

  // ===== AUTOMATION HELPER METHODS =====

  /**
   * Get active flaky tests for evaluation
   */
  static async getActiveFlakyTests(projectId: string): Promise<any[]> {
    return await prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        isActive: true,
        isQuarantined: false // Only non-quarantined tests
      },
      orderBy: {
        failureRate: 'desc' // Process highest failure rate first
      }
    });
  }

  /**
   * Get test history for evaluation
   */
  private static async getTestHistory(
    projectId: string,
    testName: string,
    testSuite?: string
  ): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.testResult.findMany({
      where: {
        project: { id: projectId },
        testName,
        testSuite: testSuite || null,
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  /**
   * Build evaluation data from test history
   */
  private static async buildEvaluationData(
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    testHistory: any[]
  ): Promise<QuarantineEvaluationData> {
    const totalRuns = testHistory.length;
    const failedRuns = testHistory.filter(t => t.status === 'failed').length;
    const failureRate = totalRuns > 0 ? failedRuns / totalRuns : 0;

    // Calculate consecutive failures from most recent results
    let consecutiveFailures = 0;
    for (const result of testHistory) {
      if (result.status === 'failed') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Get recent failures (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentFailures = testHistory.filter(t => 
      t.status === 'failed' && t.createdAt >= sevenDaysAgo
    );

    // Determine if this is a high-impact test
    const highImpactSuites = ['e2e', 'integration', 'critical', 'smoke'];
    const isHighImpact = testSuite ? 
      highImpactSuites.some(suite => testSuite.toLowerCase().includes(suite)) :
      false;

    // Get flaky test pattern for confidence
    const flakyPattern = await prisma.flakyTestPattern.findFirst({
      where: {
        projectId,
        testName,
        testSuite: testSuite || null
      }
    });

    const confidence = flakyPattern?.confidence || 0.5;
    const lastFailure = recentFailures.length > 0 ? recentFailures[0].createdAt : undefined;

    return {
      testName,
      testSuite,
      projectId,
      failureRate,
      confidence,
      totalRuns,
      failedRuns,
      consecutiveFailures,
      recentFailures,
      lastFailure,
      isHighImpact,
      ciProvider: testHistory[0]?.ciProvider,
      branch: testHistory[0]?.branch
    };
  }

  /**
   * Fixed unquarantine method with proper parameter types
   */
  static async unquarantineTest(
    flakyTestPatternId: string,
    reason: string,
    userId?: string
  ): Promise<void> {
    const triggeredBy = userId || 'auto';

    // Update the flaky test pattern
    await prisma.flakyTestPattern.update({
      where: { id: flakyTestPatternId },
      data: {
        isQuarantined: false,
        quarantinedAt: null,
        quarantinedBy: null,
        quarantineReason: null,
        updatedAt: new Date(),
      },
    });

    // Record unquarantine history
    await prisma.quarantineHistory.create({
      data: {
        flakyTestPatternId,
        action: 'unquarantined',
        reason,
        triggeredBy,
        metadata: {} as any,
      },
    });
  }
}