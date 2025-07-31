import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CrossRepoPattern } from './cross-repo-pattern-detection.service';

const prisma = new PrismaClient();

export interface PatternResolution {
  id: string;
  patternId: string;
  organizationId: string;
  resolvedBy: string;
  resolutionNotes: string;
  actionsTaken: string[];
  resolutionStrategy: 'quick-fix' | 'systematic-change' | 'process-improvement' | 'infrastructure-upgrade';
  estimatedEffort: 'low' | 'medium' | 'high';
  actualEffortHours: number;
  resolvedAt: Date;
  verifiedAt?: Date;
  verificationStatus: 'pending' | 'verified' | 'regression-detected';
  effectiveness: {
    failureReduction: number; // percentage
    stabilityImprovement: number; // 0-1 score
    costSavings: number; // estimated monthly savings
    timeToStabilization: number; // days
  };
  followUpRequired: boolean;
  followUpNotes?: string;
  relatedPatterns: string[]; // patterns that were also resolved by this fix
}

export interface ResolutionEffectivenessMetrics {
  organizationId: string;
  period: { start: Date; end: Date };
  totalResolutions: number;
  successfulResolutions: number;
  regressionRate: number;
  avgTimeToResolution: number; // hours
  avgTimeToVerification: number; // hours
  costSavingsRealized: number;
  mostEffectiveStrategies: {
    strategy: string;
    successRate: number;
    avgCostSavings: number;
  }[];
  patternRecurrenceRate: number;
  recommendedImprovements: string[];
}

export class PatternResolutionTrackingService {
  
  /**
   * Record a pattern resolution
   */
  public async recordResolution(
    patternId: string,
    organizationId: string,
    resolvedBy: string,
    resolutionData: {
      resolutionNotes: string;
      actionsTaken: string[];
      resolutionStrategy: PatternResolution['resolutionStrategy'];
      estimatedEffort: PatternResolution['estimatedEffort'];
      actualEffortHours?: number;
      relatedPatterns?: string[];
    }
  ): Promise<PatternResolution> {
    
    const resolution: PatternResolution = {
      id: `resolution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patternId,
      organizationId,
      resolvedBy,
      resolutionNotes: resolutionData.resolutionNotes,
      actionsTaken: resolutionData.actionsTaken,
      resolutionStrategy: resolutionData.resolutionStrategy,
      estimatedEffort: resolutionData.estimatedEffort,
      actualEffortHours: resolutionData.actualEffortHours || 0,
      resolvedAt: new Date(),
      verificationStatus: 'pending',
      effectiveness: {
        failureReduction: 0, // Will be calculated after verification period
        stabilityImprovement: 0,
        costSavings: 0,
        timeToStabilization: 0
      },
      followUpRequired: this.shouldRequireFollowUp(resolutionData.resolutionStrategy),
      relatedPatterns: resolutionData.relatedPatterns || []
    };

    // Store resolution (in real implementation, save to database)
    await this.storeResolution(resolution);
    
    // Schedule verification check
    this.scheduleVerificationCheck(resolution.id, 7); // Check after 7 days
    
    logger.info(`Pattern resolution recorded: ${resolution.id} for pattern ${patternId}`);
    
    return resolution;
  }

  /**
   * Verify resolution effectiveness after a period
   */
  public async verifyResolutionEffectiveness(resolutionId: string): Promise<PatternResolution> {
    const resolution = await this.getResolution(resolutionId);
    if (!resolution) {
      throw new Error(`Resolution ${resolutionId} not found`);
    }

    const verificationPeriod = 7; // days
    const verificationStart = resolution.resolvedAt;
    const verificationEnd = new Date();
    verificationEnd.setDate(verificationStart.getDate() + verificationPeriod);

    // Get test data for the affected repositories during verification period
    const testData = await this.getTestDataForVerification(
      resolution.organizationId,
      resolution.patternId,
      verificationStart,
      verificationEnd
    );

    // Calculate effectiveness metrics
    const effectiveness = await this.calculateEffectiveness(
      resolution.patternId,
      testData,
      verificationStart
    );

    // Update resolution record
    resolution.verifiedAt = new Date();
    resolution.effectiveness = effectiveness;
    resolution.verificationStatus = this.determineVerificationStatus(effectiveness);

    if (resolution.verificationStatus === 'regression-detected') {
      resolution.followUpRequired = true;
      resolution.followUpNotes = 'Regression detected - further investigation required';
    }

    await this.updateResolution(resolution);

    logger.info(`Resolution verification completed: ${resolutionId}, status: ${resolution.verificationStatus}`);
    
    return resolution;
  }

  /**
   * Get resolution effectiveness metrics for an organization
   */
  public async getEffectivenessMetrics(
    organizationId: string,
    periodDays: number = 30
  ): Promise<ResolutionEffectivenessMetrics> {
    
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - periodDays);

    const resolutions = await this.getResolutionsInPeriod(organizationId, start, end);
    
    if (resolutions.length === 0) {
      return this.getEmptyMetrics(organizationId, start, end);
    }

    const verifiedResolutions = resolutions.filter(r => r.verificationStatus !== 'pending');
    const successfulResolutions = verifiedResolutions.filter(r => r.verificationStatus === 'verified');
    const regressions = verifiedResolutions.filter(r => r.verificationStatus === 'regression-detected');

    const metrics: ResolutionEffectivenessMetrics = {
      organizationId,
      period: { start, end },
      totalResolutions: resolutions.length,
      successfulResolutions: successfulResolutions.length,
      regressionRate: verifiedResolutions.length > 0 ? regressions.length / verifiedResolutions.length : 0,
      avgTimeToResolution: this.calculateAverageResolutionTime(resolutions),
      avgTimeToVerification: this.calculateAverageVerificationTime(verifiedResolutions),
      costSavingsRealized: successfulResolutions.reduce((sum, r) => sum + r.effectiveness.costSavings, 0),
      mostEffectiveStrategies: this.analyzeStrategyEffectiveness(successfulResolutions),
      patternRecurrenceRate: await this.calculatePatternRecurrenceRate(organizationId, start, end),
      recommendedImprovements: this.generateRecommendedImprovements(resolutions, verifiedResolutions)
    };

    return metrics;
  }

  /**
   * Get trending patterns that are likely to recur
   */
  public async getTrendingRecurrencePatterns(organizationId: string): Promise<{
    patterns: Array<{
      patternType: string;
      recurrenceRate: number;
      avgTimeBetweenOccurrences: number; // days
      lastOccurrence: Date;
      suggestedPreventiveMeasures: string[];
    }>;
    overallTrend: 'improving' | 'stable' | 'deteriorating';
  }> {
    
    const patterns = await this.analyzePatternRecurrence(organizationId);
    const overallTrend = this.determineTrend(patterns);

    return {
      patterns,
      overallTrend
    };
  }

  /**
   * Generate proactive recommendations based on resolution history
   */
  public async generateProactiveRecommendations(organizationId: string): Promise<{
    immediate: string[];
    preventive: string[];
    strategic: string[];
    tooling: string[];
  }> {
    
    const metrics = await this.getEffectivenessMetrics(organizationId, 90); // 3 months
    const recurringPatterns = await this.getTrendingRecurrencePatterns(organizationId);
    
    const recommendations = {
      immediate: [] as string[],
      preventive: [] as string[],
      strategic: [] as string[],
      tooling: [] as string[]
    };

    // Immediate recommendations based on high regression rate
    if (metrics.regressionRate > 0.3) {
      recommendations.immediate.push('High regression rate detected - review resolution verification process');
      recommendations.immediate.push('Implement more comprehensive testing after pattern fixes');
    }

    // Preventive recommendations based on recurring patterns
    if (recurringPatterns.patterns.length > 0) {
      const mostRecurring = recurringPatterns.patterns[0];
      recommendations.preventive.push(`Focus on ${mostRecurring.patternType} patterns - high recurrence rate detected`);
      recommendations.preventive.push(...mostRecurring.suggestedPreventiveMeasures);
    }

    // Strategic recommendations based on cost savings
    if (metrics.costSavingsRealized > 1000) {
      recommendations.strategic.push('Pattern resolution program showing strong ROI - consider expanding');
    } else {
      recommendations.strategic.push('Low cost savings - review resolution strategies and focus on high-impact patterns');
    }

    // Tooling recommendations based on effectiveness
    const topStrategy = metrics.mostEffectiveStrategies[0];
    if (topStrategy?.strategy === 'infrastructure-upgrade') {
      recommendations.tooling.push('Infrastructure upgrades showing high success rate - invest in automation');
    }

    return recommendations;
  }

  // Private helper methods

  private shouldRequireFollowUp(strategy: PatternResolution['resolutionStrategy']): boolean {
    // Quick fixes often need follow-up to ensure they don't introduce new issues
    return strategy === 'quick-fix';
  }

  private async storeResolution(resolution: PatternResolution): Promise<void> {
    // In real implementation, store in database
    logger.debug(`Storing resolution: ${resolution.id}`);
  }

  private async updateResolution(resolution: PatternResolution): Promise<void> {
    // In real implementation, update database record
    logger.debug(`Updating resolution: ${resolution.id}`);
  }

  private async getResolution(resolutionId: string): Promise<PatternResolution | null> {
    // In real implementation, fetch from database
    return null;
  }

  private scheduleVerificationCheck(resolutionId: string, daysDelay: number): void {
    // In real implementation, use job scheduler
    setTimeout(async () => {
      await this.verifyResolutionEffectiveness(resolutionId);
    }, daysDelay * 24 * 60 * 60 * 1000);
  }

  private async getTestDataForVerification(
    organizationId: string,
    patternId: string,
    start: Date,
    end: Date
  ): Promise<any[]> {
    // Get test results for affected repositories during verification period
    const testResults = await prisma.testResult.findMany({
      where: {
        timestamp: {
          gte: start,
          lte: end
        },
        testRun: {
          project: {
            teamId: organizationId
          }
        }
      },
      include: {
        testRun: {
          select: {
            projectId: true,
            branch: true
          }
        }
      }
    });

    return testResults;
  }

  private async calculateEffectiveness(
    patternId: string,
    testData: any[],
    resolutionDate: Date
  ): Promise<PatternResolution['effectiveness']> {
    
    // Get baseline data from before resolution
    const baselineEnd = resolutionDate;
    const baselineStart = new Date(baselineEnd);
    baselineStart.setDate(baselineStart.getDate() - 14); // 2 weeks before

    const baselineData = await this.getTestDataForVerification(
      '', // organizationId not needed for this query
      patternId,
      baselineStart,
      baselineEnd
    );

    // Calculate metrics
    const baselineFailureRate = this.calculateFailureRate(baselineData);
    const currentFailureRate = this.calculateFailureRate(testData);
    
    const failureReduction = baselineFailureRate > 0 ? 
      Math.max(0, (baselineFailureRate - currentFailureRate) / baselineFailureRate * 100) : 0;

    const stabilityImprovement = this.calculateStabilityImprovement(baselineData, testData);
    const costSavings = this.estimateCostSavings(failureReduction, testData.length);
    const timeToStabilization = this.calculateTimeToStabilization(testData);

    return {
      failureReduction,
      stabilityImprovement,
      costSavings,
      timeToStabilization
    };
  }

  private calculateFailureRate(testData: any[]): number {
    if (testData.length === 0) return 0;
    const failures = testData.filter(t => t.status === 'failed').length;
    return failures / testData.length;
  }

  private calculateStabilityImprovement(baseline: any[], current: any[]): number {
    // Calculate variance reduction as stability improvement
    const baselineVariance = this.calculateFailureVariance(baseline);
    const currentVariance = this.calculateFailureVariance(current);
    
    if (baselineVariance === 0) return 0;
    return Math.max(0, (baselineVariance - currentVariance) / baselineVariance);
  }

  private calculateFailureVariance(testData: any[]): number {
    // Group by day and calculate variance in daily failure rates
    const dailyFailures = this.groupByDay(testData);
    const failureRates = Object.values(dailyFailures).map(day => 
      this.calculateFailureRate(day as any[])
    );

    if (failureRates.length < 2) return 0;

    const mean = failureRates.reduce((sum, rate) => sum + rate, 0) / failureRates.length;
    const variance = failureRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / failureRates.length;
    
    return variance;
  }

  private groupByDay(testData: any[]): Record<string, any[]> {
    return testData.reduce((groups, test) => {
      const day = new Date(test.timestamp).toDateString();
      if (!groups[day]) groups[day] = [];
      groups[day].push(test);
      return groups;
    }, {});
  }

  private estimateCostSavings(failureReduction: number, testCount: number): number {
    // Estimate monthly cost savings based on failure reduction
    const costPerFailure = 25; // $25 per failure in developer time
    const monthlyTestRuns = testCount * 4; // Estimate monthly runs
    return (failureReduction / 100) * monthlyTestRuns * costPerFailure;
  }

  private calculateTimeToStabilization(testData: any[]): number {
    // Calculate how many days it took for failure rate to stabilize
    const dailyData = this.groupByDay(testData);
    const sortedDays = Object.keys(dailyData).sort();
    
    let stabilizationDay = 0;
    const targetStabilityThreshold = 0.1; // 10% failure rate or lower
    
    for (let i = 0; i < sortedDays.length; i++) {
      const dayData = dailyData[sortedDays[i]];
      const failureRate = this.calculateFailureRate(dayData);
      
      if (failureRate <= targetStabilityThreshold) {
        stabilizationDay = i + 1;
        break;
      }
    }

    return stabilizationDay;
  }

  private determineVerificationStatus(effectiveness: PatternResolution['effectiveness']): PatternResolution['verificationStatus'] {
    // If failure reduction is less than 20%, consider it a regression
    if (effectiveness.failureReduction < 20) {
      return 'regression-detected';
    }
    
    return 'verified';
  }

  private async getResolutionsInPeriod(
    organizationId: string,
    start: Date,
    end: Date
  ): Promise<PatternResolution[]> {
    // In real implementation, fetch from database
    return [];
  }

  private getEmptyMetrics(organizationId: string, start: Date, end: Date): ResolutionEffectivenessMetrics {
    return {
      organizationId,
      period: { start, end },
      totalResolutions: 0,
      successfulResolutions: 0,
      regressionRate: 0,
      avgTimeToResolution: 0,
      avgTimeToVerification: 0,
      costSavingsRealized: 0,
      mostEffectiveStrategies: [],
      patternRecurrenceRate: 0,
      recommendedImprovements: ['Start resolving patterns to build effectiveness metrics']
    };
  }

  private calculateAverageResolutionTime(resolutions: PatternResolution[]): number {
    if (resolutions.length === 0) return 0;
    
    const totalEffort = resolutions.reduce((sum, r) => sum + r.actualEffortHours, 0);
    return totalEffort / resolutions.length;
  }

  private calculateAverageVerificationTime(resolutions: PatternResolution[]): number {
    const verificationsWithTime = resolutions.filter(r => r.verifiedAt);
    if (verificationsWithTime.length === 0) return 0;

    const totalTime = verificationsWithTime.reduce((sum, r) => {
      const timeDiff = r.verifiedAt!.getTime() - r.resolvedAt.getTime();
      return sum + (timeDiff / (1000 * 60 * 60)); // Convert to hours
    }, 0);

    return totalTime / verificationsWithTime.length;
  }

  private analyzeStrategyEffectiveness(resolutions: PatternResolution[]): ResolutionEffectivenessMetrics['mostEffectiveStrategies'] {
    const strategyStats = resolutions.reduce((stats, r) => {
      const strategy = r.resolutionStrategy;
      if (!stats[strategy]) {
        stats[strategy] = { total: 0, successful: 0, totalSavings: 0 };
      }
      
      stats[strategy].total++;
      if (r.verificationStatus === 'verified') {
        stats[strategy].successful++;
        stats[strategy].totalSavings += r.effectiveness.costSavings;
      }
      
      return stats;
    }, {} as Record<string, any>);

    return Object.entries(strategyStats)
      .map(([strategy, stats]) => ({
        strategy,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0,
        avgCostSavings: stats.successful > 0 ? stats.totalSavings / stats.successful : 0
      }))
      .sort((a, b) => b.successRate - a.successRate);
  }

  private async calculatePatternRecurrenceRate(
    organizationId: string,
    start: Date,
    end: Date
  ): Promise<number> {
    // In real implementation, analyze pattern history for recurrence
    return 0.15; // 15% recurrence rate (example)
  }

  private generateRecommendedImprovements(
    allResolutions: PatternResolution[],
    verifiedResolutions: PatternResolution[]
  ): string[] {
    const improvements: string[] = [];
    
    const quickFixCount = allResolutions.filter(r => r.resolutionStrategy === 'quick-fix').length;
    const totalCount = allResolutions.length;
    
    if (quickFixCount / totalCount > 0.6) {
      improvements.push('High percentage of quick fixes - consider more systematic approaches');
    }
    
    if (verifiedResolutions.length / allResolutions.length < 0.5) {
      improvements.push('Low verification rate - improve resolution verification process');
    }
    
    const highEffortResolutions = allResolutions.filter(r => r.actualEffortHours > 20).length;
    if (highEffortResolutions / totalCount > 0.3) {
      improvements.push('Many high-effort resolutions - invest in preventive measures');
    }

    return improvements;
  }

  private async analyzePatternRecurrence(organizationId: string): Promise<any[]> {
    // In real implementation, analyze historical patterns for recurrence trends
    return [
      {
        patternType: 'infrastructure',
        recurrenceRate: 0.25,
        avgTimeBetweenOccurrences: 14,
        lastOccurrence: new Date(),
        suggestedPreventiveMeasures: [
          'Implement infrastructure monitoring alerts',
          'Regular infrastructure health checks',
          'Automated failover testing'
        ]
      }
    ];
  }

  private determineTrend(patterns: any[]): 'improving' | 'stable' | 'deteriorating' {
    if (patterns.length === 0) return 'stable';
    
    const avgRecurrenceRate = patterns.reduce((sum, p) => sum + p.recurrenceRate, 0) / patterns.length;
    
    if (avgRecurrenceRate < 0.15) return 'improving';
    if (avgRecurrenceRate > 0.3) return 'deteriorating';
    return 'stable';
  }
}