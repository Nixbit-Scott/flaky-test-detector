import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ImpactMetrics {
  // Time Impact
  totalTimeWasted: number; // minutes
  developerHoursLost: number; // hours
  ciCdTimeWasted: number; // minutes
  
  // Cost Impact
  estimatedCostImpact: number; // USD
  developerCostImpact: number; // USD
  infrastructureCostImpact: number; // USD
  
  // Productivity Impact
  deploymentsDelayed: number;
  mergeRequestsBlocked: number;
  velocityReduction: number; // percentage
  
  // Quality Impact
  customerImpactingBugs: number;
  productionDeploymentRisk: number; // score 0-1
  technicalDebtIncrease: number; // estimated hours
}

export interface TeamConfiguration {
  averageDeveloperSalary: number; // annual USD
  infrastructureCostPerMinute: number; // USD per CI minute
  teamSize: number;
  deploymentFrequency: number; // per week
  costPerDeploymentDelay: number; // USD
}

export interface FlakyTestImpactData {
  testId: string;
  testName: string;
  projectId: string;
  failureCount: number;
  avgInvestigationTime: number; // minutes
  avgFixTime: number; // minutes
  blockedMergeRequests: number;
  delayedDeployments: number;
  falseAlerts: number;
  lastFailureDate: Date;
  impact: ImpactMetrics;
}

export class ImpactCalculatorService {
  private readonly DEFAULT_TEAM_CONFIG: TeamConfiguration = {
    averageDeveloperSalary: 120000, // $120k annually
    infrastructureCostPerMinute: 0.50, // $0.50 per CI minute
    teamSize: 8,
    deploymentFrequency: 5, // 5 deployments per week
    costPerDeploymentDelay: 2500 // $2.5k per delayed deployment
  };

  public async calculateRealTimeImpact(
    projectId: string,
    teamConfig?: Partial<TeamConfiguration>
  ): Promise<{
    totalImpact: ImpactMetrics;
    topFlakyTests: FlakyTestImpactData[];
    trendsOverTime: Array<{ date: Date; impact: ImpactMetrics }>;
    recommendations: string[];
  }> {
    const config = { ...this.DEFAULT_TEAM_CONFIG, ...teamConfig };
    
    logger.info(`Calculating real-time impact for project ${projectId}`);

    // Get flaky test data from last 30 days
    const flakyTests = await this.getFlakyTestData(projectId, 30);
    
    // Calculate impact for each test
    const testImpacts = await Promise.all(
      flakyTests.map(test => this.calculateTestImpact(test, config))
    );

    // Calculate total impact
    const totalImpact = this.aggregateImpacts(testImpacts);

    // Get trends over time
    const trendsOverTime = await this.calculateTrendsOverTime(projectId, config);

    // Generate actionable recommendations
    const recommendations = this.generateRecommendations(testImpacts, totalImpact);

    // Store calculated impact for historical tracking
    await this.storeImpactCalculation(projectId, totalImpact, testImpacts);

    return {
      totalImpact,
      topFlakyTests: testImpacts
        .sort((a, b) => b.impact.estimatedCostImpact - a.impact.estimatedCostImpact)
        .slice(0, 10),
      trendsOverTime,
      recommendations
    };
  }

  private async getFlakyTestData(projectId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get flaky test patterns from database
    const flakyPatterns = await prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        lastSeen: { gte: since }
      }
    });

    // Get related test results separately
    const testResults = await prisma.testResult.findMany({
      where: {
        projectId,
        timestamp: { gte: since },
        OR: flakyPatterns.map(pattern => ({
          testName: pattern.testName,
          testSuite: pattern.testSuite
        }))
      },
      orderBy: { timestamp: 'desc' }
    });

    return flakyPatterns.map(pattern => {
      const patternResults = testResults.filter(r => 
        r.testName === pattern.testName && r.testSuite === pattern.testSuite
      );
      
      return {
        testId: pattern.id,
        testName: pattern.testName,
        projectId: pattern.projectId,
        failureCount: patternResults.filter(r => r.status === 'failed').length,
        successCount: patternResults.filter(r => r.status === 'passed').length,
        totalRuns: patternResults.length,
        avgExecutionTime: patternResults.length > 0 ? 
          patternResults.reduce((sum, r) => sum + (r.duration || 0), 0) / patternResults.length : 0,
        lastFailureDate: patternResults.find(r => r.status === 'failed')?.timestamp || new Date(),
        failureRate: pattern.failureRate,
        confidence: pattern.confidence
      };
    });
  }

  private async calculateTestImpact(
    testData: any,
    config: TeamConfiguration
  ): Promise<FlakyTestImpactData> {
    // Calculate time impacts
    const avgInvestigationTime = this.estimateInvestigationTime(testData);
    const avgFixTime = this.estimateFixTime(testData);
    const ciCdTimeWasted = testData.failureCount * testData.avgExecutionTime;
    const totalTimeWasted = avgInvestigationTime + avgFixTime + (ciCdTimeWasted / 60);

    // Calculate productivity impacts
    const blockedMergeRequests = Math.floor(testData.failureCount * 0.3); // 30% of failures block MRs
    const delayedDeployments = Math.floor(testData.failureCount * 0.15); // 15% cause deployment delays
    const falseAlerts = Math.floor(testData.failureCount * 0.8); // 80% are false alerts

    // Calculate cost impacts
    const hourlyDeveloperCost = config.averageDeveloperSalary / (52 * 40); // weekly hours
    const developerCostImpact = (totalTimeWasted / 60) * hourlyDeveloperCost;
    const infrastructureCostImpact = ciCdTimeWasted * config.infrastructureCostPerMinute;
    const deploymentDelayCost = delayedDeployments * config.costPerDeploymentDelay;
    const estimatedCostImpact = developerCostImpact + infrastructureCostImpact + deploymentDelayCost;

    // Calculate quality impacts
    const velocityReduction = Math.min(testData.failureRate * 20, 15); // Max 15% velocity reduction
    const productionDeploymentRisk = Math.min(testData.failureRate * 0.5, 0.3); // Max 0.3 risk score
    const technicalDebtIncrease = avgFixTime / 60; // Hours of tech debt

    const impact: ImpactMetrics = {
      totalTimeWasted,
      developerHoursLost: totalTimeWasted / 60,
      ciCdTimeWasted,
      estimatedCostImpact,
      developerCostImpact,
      infrastructureCostImpact,
      deploymentsDelayed: delayedDeployments,
      mergeRequestsBlocked: blockedMergeRequests,
      velocityReduction,
      customerImpactingBugs: Math.floor(testData.failureCount * 0.05), // 5% might cause customer issues
      productionDeploymentRisk,
      technicalDebtIncrease
    };

    return {
      testId: testData.testId,
      testName: testData.testName,
      projectId: testData.projectId,
      failureCount: testData.failureCount,
      avgInvestigationTime,
      avgFixTime,
      blockedMergeRequests,
      delayedDeployments,
      falseAlerts,
      lastFailureDate: testData.lastFailureDate,
      impact
    };
  }

  private estimateInvestigationTime(testData: any): number {
    // Base investigation time based on failure complexity
    let baseTime = 15; // 15 minutes base
    
    // Adjust based on failure rate (more frequent = easier to reproduce)
    if (testData.failureRate > 0.5) baseTime += 30; // Hard to reproduce
    if (testData.failureRate > 0.8) baseTime += 45; // Very hard to reproduce
    
    // Adjust based on confidence (lower confidence = more investigation)
    if (testData.confidence < 0.7) baseTime += 20;
    
    return baseTime;
  }

  private estimateFixTime(testData: any): number {
    // Base fix time
    let baseTime = 45; // 45 minutes base
    
    // Adjust based on failure patterns
    if (testData.failureRate > 0.7) baseTime += 60; // Complex flaky patterns
    if (testData.failureCount > 20) baseTime += 30; // Frequently failing
    
    return baseTime;
  }

  private aggregateImpacts(testImpacts: FlakyTestImpactData[]): ImpactMetrics {
    return testImpacts.reduce((total, test) => ({
      totalTimeWasted: total.totalTimeWasted + test.impact.totalTimeWasted,
      developerHoursLost: total.developerHoursLost + test.impact.developerHoursLost,
      ciCdTimeWasted: total.ciCdTimeWasted + test.impact.ciCdTimeWasted,
      estimatedCostImpact: total.estimatedCostImpact + test.impact.estimatedCostImpact,
      developerCostImpact: total.developerCostImpact + test.impact.developerCostImpact,
      infrastructureCostImpact: total.infrastructureCostImpact + test.impact.infrastructureCostImpact,
      deploymentsDelayed: total.deploymentsDelayed + test.impact.deploymentsDelayed,
      mergeRequestsBlocked: total.mergeRequestsBlocked + test.impact.mergeRequestsBlocked,
      velocityReduction: Math.min(total.velocityReduction + test.impact.velocityReduction, 50), // Cap at 50%
      customerImpactingBugs: total.customerImpactingBugs + test.impact.customerImpactingBugs,
      productionDeploymentRisk: Math.min(total.productionDeploymentRisk + test.impact.productionDeploymentRisk, 1.0),
      technicalDebtIncrease: total.technicalDebtIncrease + test.impact.technicalDebtIncrease
    }), {
      totalTimeWasted: 0,
      developerHoursLost: 0,
      ciCdTimeWasted: 0,
      estimatedCostImpact: 0,
      developerCostImpact: 0,
      infrastructureCostImpact: 0,
      deploymentsDelayed: 0,
      mergeRequestsBlocked: 0,
      velocityReduction: 0,
      customerImpactingBugs: 0,
      productionDeploymentRisk: 0,
      technicalDebtIncrease: 0
    });
  }

  private async calculateTrendsOverTime(
    projectId: string,
    config: TeamConfiguration
  ): Promise<Array<{ date: Date; impact: ImpactMetrics }>> {
    const trends: Array<{ date: Date; impact: ImpactMetrics }> = [];
    const daysToCalculate = 30;

    for (let i = daysToCalculate; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayEndDate = new Date(date);
      dayEndDate.setHours(23, 59, 59, 999);

      // Get test results for this specific day
      const dayTestResults = await prisma.testResult.findMany({
        where: {
          projectId,
          timestamp: {
            gte: date,
            lte: dayEndDate
          }
        },
        include: {
          testRun: true
        }
      });

      // Calculate flaky tests for this day
      const flakyTestsThisDay = this.identifyFlakyTestsFromResults(dayTestResults);
      
      // Calculate impact for this day
      const dayImpacts = await Promise.all(
        flakyTestsThisDay.map(test => this.calculateTestImpact(test, config))
      );

      const dayTotalImpact = this.aggregateImpacts(dayImpacts);

      trends.push({
        date,
        impact: dayTotalImpact
      });
    }

    return trends;
  }

  private identifyFlakyTestsFromResults(testResults: any[]) {
    const testGroups = testResults.reduce((groups, result) => {
      const key = `${result.testName}-${result.testSuite}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(result);
      return groups;
    }, {} as Record<string, any[]>);

    return Object.entries(testGroups)
      .map(([testName, results]) => {
        const typedResults = results as any[];
        const failures = typedResults.filter((r: any) => r.status === 'failed');
        const successes = typedResults.filter((r: any) => r.status === 'passed');
        const total = typedResults.length;

        if (total < 3 || failures.length === 0 || successes.length === 0) {
          return null; // Not enough data or not flaky
        }

        const failureRate = failures.length / total;
        if (failureRate < 0.1 || failureRate > 0.9) {
          return null; // Not flaky (too consistent)
        }

        return {
          testId: testName,
          testName: testName.split('-')[0],
          projectId: typedResults[0].projectId,
          failureCount: failures.length,
          successCount: successes.length,
          totalRuns: total,
          avgExecutionTime: typedResults.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / total,
          lastFailureDate: failures[failures.length - 1]?.timestamp || new Date(),
          failureRate,
          confidence: Math.min(total / 10, 1.0) // Confidence based on sample size
        };
      })
      .filter(Boolean);
  }

  private generateRecommendations(
    testImpacts: FlakyTestImpactData[],
    totalImpact: ImpactMetrics
  ): string[] {
    const recommendations: string[] = [];

    // High-cost test recommendations
    const highCostTests = testImpacts.filter(t => t.impact.estimatedCostImpact > 1000);
    if (highCostTests.length > 0) {
      recommendations.push(
        `Priority: Fix ${highCostTests.length} high-cost flaky tests that are causing $${Math.round(highCostTests.reduce((sum, t) => sum + t.impact.estimatedCostImpact, 0))} in impact`
      );
    }

    // Deployment blocking tests
    const deploymentBlockers = testImpacts.filter(t => t.delayedDeployments > 0);
    if (deploymentBlockers.length > 0) {
      recommendations.push(
        `Critical: ${deploymentBlockers.length} tests are blocking deployments. Consider quarantining or implementing intelligent retry strategies.`
      );
    }

    // Velocity impact
    if (totalImpact.velocityReduction > 10) {
      recommendations.push(
        `Team velocity is reduced by ${Math.round(totalImpact.velocityReduction)}%. Focus on fixing tests with highest failure rates first.`
      );
    }

    // CI/CD cost optimization
    if (totalImpact.infrastructureCostImpact > 500) {
      recommendations.push(
        `CI/CD costs could be reduced by $${Math.round(totalImpact.infrastructureCostImpact)} monthly by fixing flaky tests and optimizing retry strategies.`
      );
    }

    // Technical debt warning
    if (totalImpact.technicalDebtIncrease > 40) {
      recommendations.push(
        `Flaky tests are adding ${Math.round(totalImpact.technicalDebtIncrease)} hours of technical debt monthly. Implement systematic fixing process.`
      );
    }

    return recommendations;
  }

  private async storeImpactCalculation(
    projectId: string,
    totalImpact: ImpactMetrics,
    testImpacts: FlakyTestImpactData[]
  ): Promise<void> {
    try {
      await prisma.impactCalculation.create({
        data: {
          projectId,
          calculationDate: new Date(),
          totalTimeWasted: totalImpact.totalTimeWasted,
          estimatedCostImpact: totalImpact.estimatedCostImpact,
          deploymentsDelayed: totalImpact.deploymentsDelayed,
          mergeRequestsBlocked: totalImpact.mergeRequestsBlocked,
          velocityReduction: totalImpact.velocityReduction,
          impactData: totalImpact as any, // Store full impact data as JSON
          testImpacts: testImpacts as any, // Store individual test impacts
        }
      });

      logger.info(`Stored impact calculation for project ${projectId}: $${Math.round(totalImpact.estimatedCostImpact)} impact`);
    } catch (error) {
      logger.error('Error storing impact calculation:', error);
    }
  }

  public async getHistoricalImpact(
    projectId: string,
    days: number = 30
  ): Promise<Array<{ date: Date; impact: ImpactMetrics }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const calculations = await prisma.impactCalculation.findMany({
      where: {
        projectId,
        calculationDate: { gte: since }
      },
      orderBy: { calculationDate: 'asc' }
    });

    return calculations.map(calc => ({
      date: calc.calculationDate,
      impact: calc.impactData as unknown as ImpactMetrics
    }));
  }

  public async getTeamConfiguration(projectId: string): Promise<TeamConfiguration> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true }
    });

    // Return team config from project settings or defaults
    return (project?.teamConfiguration as unknown as TeamConfiguration) || this.DEFAULT_TEAM_CONFIG;
  }

  public async updateTeamConfiguration(
    projectId: string,
    config: Partial<TeamConfiguration>
  ): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        teamConfiguration: config as any
      }
    });
  }
}