import { prisma } from './database.service';

export interface QuarantineAnalytics {
  summary: QuarantineSummary;
  trends: QuarantineTrends;
  impact: QuarantineImpactMetrics;
  effectiveness: QuarantineEffectiveness;
  recommendations: string[];
}

export interface QuarantineSummary {
  totalQuarantined: number;
  currentlyQuarantined: number;
  autoQuarantined: number;
  manualQuarantined: number;
  autoUnquarantined: number;
  manualUnquarantined: number;
  avgQuarantineDuration: number; // days
  longestQuarantine: number; // days
}

export interface QuarantineTrends {
  daily: Array<{
    date: string;
    quarantined: number;
    unquarantined: number;
    net: number;
  }>;
  categoryDistribution: Record<string, number>;
  topQuarantinedTests: Array<{
    testName: string;
    testSuite?: string;
    quarantineDays: number;
    reason: string;
  }>;
}

export interface QuarantineImpactMetrics {
  ciTimeSaved: number; // minutes
  developerHoursSaved: number;
  buildsProtected: number;
  costSavings: {
    ciCostSaved: number; // dollars
    developerCostSaved: number; // dollars
    totalSaved: number; // dollars
  };
  productivity: {
    testStabilityImprovement: number; // percentage
    buildSuccessRateImprovement: number; // percentage
    falsePositiveRate: number; // percentage
  };
}

export interface QuarantineEffectiveness {
  accuracyMetrics: {
    truePositives: number; // Correctly quarantined flaky tests
    falsePositives: number; // Incorrectly quarantined stable tests
    trueNegatives: number; // Correctly left unquarantined stable tests
    falseNegatives: number; // Missed flaky tests
    precision: number; // TP / (TP + FP)
    recall: number; // TP / (TP + FN)
    f1Score: number; // 2 * (precision * recall) / (precision + recall)
  };
  unquarantineSuccess: {
    successfulUnquarantines: number;
    prematureUnquarantines: number; // Tests that became flaky again
    successRate: number; // percentage
  };
  policyEffectiveness: {
    policyName?: string;
    coverage: number; // percentage of tests covered by policies
    avgConfidenceScore: number;
    rulesTriggered: Record<string, number>;
  };
}

export class QuarantineAnalyticsService {
  /**
   * Get comprehensive quarantine analytics for a project
   */
  static async getProjectAnalytics(
    projectId: string,
    timeRange: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<QuarantineAnalytics> {
    const daysBack = this.getTimeRangeDays(timeRange);
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const [summary, trends, impact, effectiveness] = await Promise.all([
      this.generateSummary(projectId, startDate),
      this.generateTrends(projectId, startDate),
      this.generateImpactMetrics(projectId, startDate),
      this.generateEffectivenessMetrics(projectId, startDate),
    ]);

    const recommendations = await this.generateRecommendations(projectId, {
      summary,
      trends,
      impact,
      effectiveness,
    });

    return {
      summary,
      trends,
      impact,
      effectiveness,
      recommendations,
    };
  }

  /**
   * Track quarantine impact for a specific test
   */
  static async trackQuarantineImpact(
    projectId: string,
    flakyTestPatternId: string,
    impactData: {
      buildsBlocked?: number;
      ciTimeWasted?: number; // minutes
      developerHours?: number;
      falsePositive?: boolean;
    }
  ): Promise<void> {
    await prisma.quarantineImpact.upsert({
      where: {
        projectId_flakyTestPatternId: {
          projectId,
          flakyTestPatternId,
        },
      },
      update: {
        buildsBlocked: { increment: impactData.buildsBlocked || 0 },
        ciTimeWasted: { increment: impactData.ciTimeWasted || 0 },
        developerHours: { increment: impactData.developerHours || 0 },
        falsePositives: impactData.falsePositive ? { increment: 1 } : undefined,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        flakyTestPatternId,
        buildsBlocked: impactData.buildsBlocked || 0,
        ciTimeWasted: impactData.ciTimeWasted || 0,
        developerHours: impactData.developerHours || 0,
        falsePositives: impactData.falsePositive ? 1 : 0,
        periodStart: new Date(),
      },
    });
  }

  /**
   * Calculate cost savings from quarantine system
   */
  static async calculateCostSavings(
    projectId: string,
    costConfig: {
      ciCostPerMinute: number; // dollars per CI minute
      developerHourlyCost: number; // dollars per developer hour
    }
  ): Promise<{
    totalCiTimeSaved: number;
    totalDeveloperHoursSaved: number;
    totalCostSaved: number;
  }> {
    const impacts = await prisma.quarantineImpact.findMany({
      where: { projectId },
    });

    const totalCiTimeSaved = impacts.reduce((sum, impact) => sum + impact.ciTimeWasted, 0);
    const totalDeveloperHoursSaved = impacts.reduce((sum, impact) => sum + impact.developerHours, 0);

    const ciCostSaved = totalCiTimeSaved * costConfig.ciCostPerMinute;
    const developerCostSaved = totalDeveloperHoursSaved * costConfig.developerHourlyCost;
    const totalCostSaved = ciCostSaved + developerCostSaved;

    return {
      totalCiTimeSaved,
      totalDeveloperHoursSaved,
      totalCostSaved,
    };
  }

  /**
   * Generate quarantine effectiveness report
   */
  static async generateEffectivenessReport(projectId: string): Promise<{
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    actionItems: string[];
  }> {
    const analytics = await this.getProjectAnalytics(projectId);
    const { effectiveness, impact } = analytics;

    let overallScore = 0;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const actionItems: string[] = [];

    // Evaluate precision (avoiding false positives)
    if (effectiveness.accuracyMetrics.precision >= 0.8) {
      overallScore += 25;
      strengths.push(`High precision (${(effectiveness.accuracyMetrics.precision * 100).toFixed(1)}%) - few false positives`);
    } else if (effectiveness.accuracyMetrics.precision < 0.6) {
      weaknesses.push(`Low precision (${(effectiveness.accuracyMetrics.precision * 100).toFixed(1)}%) - too many false positives`);
      actionItems.push('Increase confidence thresholds to reduce false positives');
    }

    // Evaluate recall (catching flaky tests)
    if (effectiveness.accuracyMetrics.recall >= 0.7) {
      overallScore += 25;
      strengths.push(`Good recall (${(effectiveness.accuracyMetrics.recall * 100).toFixed(1)}%) - catching most flaky tests`);
    } else if (effectiveness.accuracyMetrics.recall < 0.5) {
      weaknesses.push(`Low recall (${(effectiveness.accuracyMetrics.recall * 100).toFixed(1)}%) - missing flaky tests`);
      actionItems.push('Lower quarantine thresholds to catch more flaky tests');
    }

    // Evaluate unquarantine success
    if (effectiveness.unquarantineSuccess.successRate >= 0.8) {
      overallScore += 25;
      strengths.push(`High unquarantine success rate (${effectiveness.unquarantineSuccess.successRate.toFixed(1)}%)`);
    } else if (effectiveness.unquarantineSuccess.successRate < 0.6) {
      weaknesses.push(`Low unquarantine success rate (${effectiveness.unquarantineSuccess.successRate.toFixed(1)}%)`);
      actionItems.push('Extend stability requirements before unquarantining');
    }

    // Evaluate impact
    if (impact.buildsProtected > 10) {
      overallScore += 15;
      strengths.push(`Protected ${impact.buildsProtected} builds from flaky failures`);
    }

    if (impact.ciTimeSaved > 100) {
      overallScore += 10;
      strengths.push(`Saved ${impact.ciTimeSaved} minutes of CI time`);
    }

    // Evaluate false positive rate
    if (impact.productivity.falsePositiveRate < 0.1) {
      strengths.push(`Low false positive rate (${(impact.productivity.falsePositiveRate * 100).toFixed(1)}%)`);
    } else if (impact.productivity.falsePositiveRate > 0.2) {
      weaknesses.push(`High false positive rate (${(impact.productivity.falsePositiveRate * 100).toFixed(1)}%)`);
      actionItems.push('Review quarantine criteria to reduce false positives');
    }

    // Add general recommendations
    if (analytics.summary.currentlyQuarantined === 0) {
      actionItems.push('Consider running analysis to identify flaky tests for quarantine');
    }

    if (analytics.summary.avgQuarantineDuration > 30) {
      actionItems.push('Review unquarantine criteria - tests may be quarantined too long');
    }

    return {
      overallScore: Math.min(overallScore, 100),
      strengths,
      weaknesses,
      actionItems,
    };
  }

  // Private helper methods

  private static getTimeRangeDays(timeRange: 'week' | 'month' | 'quarter'): number {
    switch (timeRange) {
      case 'week': return 7;
      case 'month': return 30;
      case 'quarter': return 90;
    }
  }

  private static async generateSummary(projectId: string, startDate: Date): Promise<QuarantineSummary> {
    const [currentQuarantined, quarantineHistory] = await Promise.all([
      prisma.flakyTestPattern.count({
        where: { projectId, isQuarantined: true },
      }),
      prisma.quarantineHistory.findMany({
        where: {
          flakyTestPattern: { projectId },
          createdAt: { gte: startDate },
        },
      }),
    ]);

    const quarantineActions = quarantineHistory.filter(h => h.action === 'quarantined');
    const unquarantineActions = quarantineHistory.filter(h => h.action === 'unquarantined');

    const autoQuarantined = quarantineActions.filter(h => h.triggeredBy === 'auto').length;
    const autoUnquarantined = unquarantineActions.filter(h => h.triggeredBy === 'auto').length;

    // Calculate average quarantine duration
    const completedQuarantines = await prisma.quarantineImpact.findMany({
      where: { projectId, periodEnd: { not: null } },
    });

    const avgQuarantineDuration = completedQuarantines.length > 0 ?
      completedQuarantines.reduce((sum, q) => sum + q.quarantinePeriod, 0) / completedQuarantines.length :
      0;

    const longestQuarantine = completedQuarantines.length > 0 ?
      Math.max(...completedQuarantines.map(q => q.quarantinePeriod)) :
      0;

    return {
      totalQuarantined: quarantineActions.length,
      currentlyQuarantined: currentQuarantined,
      autoQuarantined,
      manualQuarantined: quarantineActions.length - autoQuarantined,
      autoUnquarantined,
      manualUnquarantined: unquarantineActions.length - autoUnquarantined,
      avgQuarantineDuration,
      longestQuarantine,
    };
  }

  private static async generateTrends(projectId: string, startDate: Date): Promise<QuarantineTrends> {
    const quarantineHistory = await prisma.quarantineHistory.findMany({
      where: {
        flakyTestPattern: { projectId },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Generate daily trends
    const daily = this.aggregateByDay(quarantineHistory, startDate);

    // Category distribution (based on failure reasons)
    const categoryDistribution = quarantineHistory.reduce((acc, history) => {
      if (history.action === 'quarantined' && history.reason) {
        const category = this.categorizeQuarantineReason(history.reason);
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Top quarantined tests
    const topQuarantinedTests = await prisma.flakyTestPattern.findMany({
      where: { projectId, isQuarantined: true },
      include: { quarantineHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { quarantinedAt: 'asc' },
      take: 10,
    });

    const topTests = topQuarantinedTests.map(test => ({
      testName: test.testName,
      testSuite: test.testSuite || undefined,
      quarantineDays: test.quarantinedAt ? 
        Math.floor((Date.now() - test.quarantinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      reason: test.quarantineReason || 'Unknown',
    }));

    return {
      daily,
      categoryDistribution,
      topQuarantinedTests: topTests,
    };
  }

  private static async generateImpactMetrics(projectId: string, startDate: Date): Promise<QuarantineImpactMetrics> {
    const impacts = await prisma.quarantineImpact.findMany({
      where: { projectId },
    });

    const ciTimeSaved = impacts.reduce((sum, impact) => sum + impact.ciTimeWasted, 0);
    const developerHoursSaved = impacts.reduce((sum, impact) => sum + impact.developerHours, 0);
    const buildsProtected = impacts.reduce((sum, impact) => sum + impact.buildsBlocked, 0);

    // Cost calculations (using default rates)
    const ciCostPerMinute = 0.10; // $0.10 per CI minute
    const developerHourlyCost = 75; // $75 per developer hour

    const ciCostSaved = ciTimeSaved * ciCostPerMinute;
    const developerCostSaved = developerHoursSaved * developerHourlyCost;
    const totalSaved = ciCostSaved + developerCostSaved;

    // Calculate productivity metrics
    const totalQuarantines = impacts.length;
    const falsePositives = impacts.reduce((sum, impact) => sum + impact.falsePositives, 0);
    const falsePositiveRate = totalQuarantines > 0 ? falsePositives / totalQuarantines : 0;

    // Estimate improvements (simplified calculations)
    const testStabilityImprovement = totalQuarantines > 0 ? Math.min((buildsProtected / totalQuarantines) * 10, 50) : 0;
    const buildSuccessRateImprovement = buildsProtected > 0 ? Math.min(buildsProtected * 2, 25) : 0;

    return {
      ciTimeSaved,
      developerHoursSaved,
      buildsProtected,
      costSavings: {
        ciCostSaved,
        developerCostSaved,
        totalSaved,
      },
      productivity: {
        testStabilityImprovement,
        buildSuccessRateImprovement,
        falsePositiveRate,
      },
    };
  }

  private static async generateEffectivenessMetrics(projectId: string, startDate: Date): Promise<QuarantineEffectiveness> {
    const [flakyTests, quarantineHistory, impacts] = await Promise.all([
      prisma.flakyTestPattern.findMany({ where: { projectId } }),
      prisma.quarantineHistory.findMany({
        where: {
          flakyTestPattern: { projectId },
          createdAt: { gte: startDate },
        },
      }),
      prisma.quarantineImpact.findMany({ where: { projectId } }),
    ]);

    // Calculate accuracy metrics (simplified)
    const quarantinedFlaky = flakyTests.filter(t => t.isQuarantined && t.failureRate > 0.3).length;
    const quarantinedStable = flakyTests.filter(t => t.isQuarantined && t.failureRate <= 0.3).length;
    const unquarantinedFlaky = flakyTests.filter(t => !t.isQuarantined && t.failureRate > 0.3).length;
    const unquarantinedStable = flakyTests.filter(t => !t.isQuarantined && t.failureRate <= 0.3).length;

    const truePositives = quarantinedFlaky;
    const falsePositives = quarantinedStable;
    const trueNegatives = unquarantinedStable;
    const falseNegatives = unquarantinedFlaky;

    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Unquarantine success metrics
    const unquarantineActions = quarantineHistory.filter(h => h.action === 'unquarantined');
    const completedQuarantines = impacts.filter(i => i.periodEnd !== null);
    const prematureUnquarantines = impacts.filter(i => i.periodEnd && i.autoUnquarantined && i.quarantinePeriod < 3).length;
    
    const successfulUnquarantines = Math.max(0, unquarantineActions.length - prematureUnquarantines);
    const unquarantineSuccessRate = unquarantineActions.length > 0 ? 
      (successfulUnquarantines / unquarantineActions.length) * 100 : 0;

    // Policy effectiveness
    const autoQuarantines = quarantineHistory.filter(h => h.action === 'quarantined' && h.triggeredBy === 'auto').length;
    const coverage = flakyTests.length > 0 ? (autoQuarantines / flakyTests.length) * 100 : 0;
    const avgConfidenceScore = flakyTests.length > 0 ? 
      flakyTests.reduce((sum, t) => sum + t.confidence, 0) / flakyTests.length : 0;

    // Rules triggered (simplified categorization)
    const rulesTriggered = quarantineHistory.reduce((acc, history) => {
      if (history.action === 'quarantined' && history.reason) {
        const rule = this.extractRuleFromReason(history.reason);
        acc[rule] = (acc[rule] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      accuracyMetrics: {
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives,
        precision,
        recall,
        f1Score,
      },
      unquarantineSuccess: {
        successfulUnquarantines,
        prematureUnquarantines,
        successRate: unquarantineSuccessRate,
      },
      policyEffectiveness: {
        coverage,
        avgConfidenceScore,
        rulesTriggered,
      },
    };
  }

  private static async generateRecommendations(
    projectId: string,
    analytics: Omit<QuarantineAnalytics, 'recommendations'>
  ): Promise<string[]> {
    const recommendations: string[] = [];
    const { summary, impact, effectiveness } = analytics;

    // Recommendations based on precision/recall
    if (effectiveness.accuracyMetrics.precision < 0.7) {
      recommendations.push('Consider increasing confidence thresholds to reduce false positives');
    }
    if (effectiveness.accuracyMetrics.recall < 0.6) {
      recommendations.push('Consider lowering failure rate thresholds to catch more flaky tests');
    }

    // Recommendations based on quarantine duration
    if (summary.avgQuarantineDuration > 30) {
      recommendations.push('Review unquarantine criteria - tests may be quarantined too long');
    }
    if (summary.avgQuarantineDuration < 3) {
      recommendations.push('Consider extending stability period to ensure tests are truly stable');
    }

    // Recommendations based on impact
    if (impact.productivity.falsePositiveRate > 0.2) {
      recommendations.push('High false positive rate detected - review quarantine policies');
    }
    if (impact.buildsProtected < 5 && summary.totalQuarantined > 10) {
      recommendations.push('Quarantine system may not be protecting enough builds - review impact tracking');
    }

    // Recommendations based on automation
    const autoPercentage = summary.totalQuarantined > 0 ? 
      summary.autoQuarantined / summary.totalQuarantined : 0;
    if (autoPercentage < 0.8) {
      recommendations.push('Consider enabling more automated quarantine rules to reduce manual effort');
    }

    // Recommendations based on unquarantine success
    if (effectiveness.unquarantineSuccess.successRate < 70) {
      recommendations.push('Low unquarantine success rate - consider extending stability requirements');
    }

    return recommendations;
  }

  private static aggregateByDay(history: any[], startDate: Date): Array<{
    date: string;
    quarantined: number;
    unquarantined: number;
    net: number;
  }> {
    const days: Record<string, { quarantined: number; unquarantined: number }> = {};
    
    // Initialize all days in range
    const currentDate = new Date(startDate);
    const endDate = new Date();
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      days[dateStr] = { quarantined: 0, unquarantined: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate history by day
    history.forEach(h => {
      const dateStr = h.createdAt.toISOString().split('T')[0];
      if (days[dateStr]) {
        if (h.action === 'quarantined') {
          days[dateStr].quarantined++;
        } else if (h.action === 'unquarantined') {
          days[dateStr].unquarantined++;
        }
      }
    });

    return Object.entries(days).map(([date, counts]) => ({
      date,
      quarantined: counts.quarantined,
      unquarantined: counts.unquarantined,
      net: counts.quarantined - counts.unquarantined,
    }));
  }

  private static categorizeQuarantineReason(reason: string): string {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('failure rate')) return 'High Failure Rate';
    if (lowerReason.includes('consecutive')) return 'Consecutive Failures';
    if (lowerReason.includes('critical') || lowerReason.includes('impact')) return 'Critical Path';
    if (lowerReason.includes('degradation')) return 'Rapid Degradation';
    return 'Other';
  }

  private static extractRuleFromReason(reason: string): string {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('failure rate')) return 'failure_rate';
    if (lowerReason.includes('consecutive')) return 'consecutive_failures';
    if (lowerReason.includes('critical')) return 'critical_path';
    if (lowerReason.includes('degradation')) return 'rapid_degradation';
    return 'other';
  }
}