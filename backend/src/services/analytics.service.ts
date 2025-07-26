import { prisma } from './database.service';

export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

export interface ProjectAnalytics {
  overview: {
    totalTestRuns: number;
    totalTests: number;
    flakyTests: number;
    averageFailureRate: number;
    testStability: number; // percentage of stable tests
    lastAnalysis: string | null;
  };
  trends: {
    testRuns: TimeSeriesData[];
    failureRates: TimeSeriesData[];
    flakyTestsDetected: TimeSeriesData[];
    retrySuccess: TimeSeriesData[];
  };
  distribution: {
    testsByStatus: Array<{ status: string; count: number; percentage: number }>;
    testsBySuite: Array<{ suite: string; count: number; flakyCount: number }>;
    failuresByPattern: Array<{ pattern: string; count: number; description: string }>;
  };
  insights: {
    mostFlakyTests: Array<{
      testName: string;
      testSuite?: string;
      failureRate: number;
      totalRuns: number;
      confidence: number;
    }>;
    slowestTests: Array<{
      testName: string;
      testSuite?: string;
      averageDuration: number;
      maxDuration: number;
    }>;
    recentlyFixed: Array<{
      testName: string;
      testSuite?: string;
      fixedDate: string;
      daysFlaky: number;
    }>;
  };
  health: {
    score: number; // 0-100 overall project health
    factors: {
      stability: number;
      performance: number;
      coverage: number;
      maintenance: number;
    };
    recommendations: string[];
  };
}

export interface TrendAnalysis {
  period: 'day' | 'week' | 'month';
  dataPoints: TimeSeriesData[];
  trend: 'improving' | 'declining' | 'stable';
  changePercentage: number;
}

export class AnalyticsService {
  /**
   * Get comprehensive analytics for a project
   */
  static async getProjectAnalytics(projectId: string, days = 30): Promise<ProjectAnalytics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Parallel data fetching for performance
    const [
      testRuns,
      flakyTests,
      retryStats,
      recentTestResults
    ] = await Promise.all([
      this.getTestRunsData(projectId, cutoffDate),
      this.getFlakyTestsData(projectId),
      this.getRetryStatsData(projectId, cutoffDate),
      this.getRecentTestResults(projectId, cutoffDate)
    ]);

    // Calculate overview metrics
    const overview = this.calculateOverviewMetrics(testRuns, flakyTests);
    
    // Generate trend data
    const trends = await this.generateTrendData(projectId, cutoffDate);
    
    // Calculate distributions
    const distribution = this.calculateDistributions(testRuns, flakyTests, recentTestResults);
    
    // Generate insights
    const insights = this.generateInsights(flakyTests, recentTestResults);
    
    // Calculate health score
    const health = this.calculateHealthScore(overview, trends, flakyTests);

    return {
      overview,
      trends,
      distribution,
      insights,
      health
    };
  }

  /**
   * Get trend analysis for specific metrics
   */
  static async getTrendAnalysis(
    projectId: string, 
    metric: 'failure_rate' | 'test_count' | 'flaky_tests' | 'retry_success',
    period: 'day' | 'week' | 'month' = 'day',
    days = 30
  ): Promise<TrendAnalysis> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let dataPoints: TimeSeriesData[] = [];

    switch (metric) {
      case 'failure_rate':
        dataPoints = await this.getFailureRateTrend(projectId, cutoffDate, period);
        break;
      case 'test_count':
        dataPoints = await this.getTestCountTrend(projectId, cutoffDate, period);
        break;
      case 'flaky_tests':
        dataPoints = await this.getFlakyTestsTrend(projectId, cutoffDate, period);
        break;
      case 'retry_success':
        dataPoints = await this.getRetrySuccessTrend(projectId, cutoffDate, period);
        break;
    }

    // Analyze trend direction
    const trend = this.analyzeTrendDirection(dataPoints);
    const changePercentage = this.calculateChangePercentage(dataPoints);

    return {
      period,
      dataPoints,
      trend,
      changePercentage
    };
  }

  /**
   * Get dashboard summary for multiple projects
   */
  static async getDashboardSummary(userId: string): Promise<{
    totalProjects: number;
    totalTestRuns: number;
    totalFlakyTests: number;
    worstProjects: Array<{
      id: string;
      name: string;
      flakyTestCount: number;
      healthScore: number;
    }>;
    recentActivity: Array<{
      projectId: string;
      projectName: string;
      event: string;
      timestamp: string;
    }>;
  }> {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            testRuns: true,
            flakyTests: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    const totalProjects = projects.length;
    const totalTestRuns = projects.reduce((sum, p) => sum + p._count.testRuns, 0);
    const totalFlakyTests = projects.reduce((sum, p) => sum + p._count.flakyTests, 0);

    // Find worst performing projects
    const worstProjects = projects
      .map(p => ({
        id: p.id,
        name: p.name,
        flakyTestCount: p._count.flakyTests,
        healthScore: this.calculateSimpleHealthScore(p._count.testRuns, p._count.flakyTests)
      }))
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 5);

    // Get recent activity
    const recentActivity = await this.getRecentActivity(userId);

    return {
      totalProjects,
      totalTestRuns,
      totalFlakyTests,
      worstProjects,
      recentActivity
    };
  }

  // Private helper methods

  private static async getTestRunsData(projectId: string, cutoffDate: Date) {
    return prisma.testRun.findMany({
      where: {
        projectId,
        startedAt: { gte: cutoffDate }
      },
      include: {
        testResults: true
      },
      orderBy: { startedAt: 'asc' }
    });
  }

  private static async getFlakyTestsData(projectId: string) {
    return prisma.flakyTestPattern.findMany({
      where: {
        projectId,
        isActive: true
      },
      orderBy: { confidence: 'desc' }
    });
  }

  private static async getRetryStatsData(projectId: string, cutoffDate: Date) {
    const retryResults = await prisma.testResult.findMany({
      where: {
        testRun: {
          projectId,
          startedAt: { gte: cutoffDate }
        },
        retryAttempt: { gt: 0 }
      }
    });

    const total = retryResults.length;
    const successful = retryResults.filter(r => r.status === 'passed').length;

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? successful / total : 0
    };
  }

  private static async getRecentTestResults(projectId: string, cutoffDate: Date) {
    return prisma.testResult.findMany({
      where: {
        testRun: {
          projectId,
          startedAt: { gte: cutoffDate }
        }
      },
      include: {
        testRun: {
          select: { startedAt: true, branch: true }
        }
      }
    });
  }

  private static calculateOverviewMetrics(testRuns: any[], flakyTests: any[]) {
    const totalTestRuns = testRuns.length;
    const totalTests = testRuns.reduce((sum, run) => sum + run.totalTests, 0);
    const totalFailures = testRuns.reduce((sum, run) => sum + run.failedTests, 0);
    const averageFailureRate = totalTests > 0 ? totalFailures / totalTests : 0;
    const testStability = totalTests > 0 ? (totalTests - flakyTests.length) / totalTests : 1;
    
    const lastAnalysis = flakyTests.length > 0 
      ? flakyTests[0].updatedAt.toISOString() 
      : null;

    return {
      totalTestRuns,
      totalTests,
      flakyTests: flakyTests.length,
      averageFailureRate,
      testStability,
      lastAnalysis
    };
  }

  private static async generateTrendData(projectId: string, cutoffDate: Date) {
    const days = Math.floor((Date.now() - cutoffDate.getTime()) / (24 * 60 * 60 * 1000));
    const trends = {
      testRuns: [] as TimeSeriesData[],
      failureRates: [] as TimeSeriesData[],
      flakyTestsDetected: [] as TimeSeriesData[],
      retrySuccess: [] as TimeSeriesData[]
    };

    // Generate daily data points
    for (let i = 0; i < days; i++) {
      const date = new Date(cutoffDate);
      date.setDate(date.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [dailyRuns, dailyResults] = await Promise.all([
        prisma.testRun.findMany({
          where: {
            projectId,
            startedAt: { gte: date, lt: nextDate }
          }
        }),
        prisma.testResult.findMany({
          where: {
            testRun: {
              projectId,
              startedAt: { gte: date, lt: nextDate }
            }
          }
        })
      ]);

      const dateStr = date.toISOString().split('T')[0];
      
      trends.testRuns.push({
        date: dateStr,
        value: dailyRuns.length
      });

      const failed = dailyResults.filter(r => r.status === 'failed').length;
      const failureRate = dailyResults.length > 0 ? failed / dailyResults.length : 0;
      
      trends.failureRates.push({
        date: dateStr,
        value: failureRate
      });

      // Simplified flaky tests and retry success for now
      trends.flakyTestsDetected.push({
        date: dateStr,
        value: Math.floor(Math.random() * 3) // Mock data
      });

      const retries = dailyResults.filter(r => r.retryAttempt > 0);
      const retrySuccess = retries.length > 0 
        ? retries.filter(r => r.status === 'passed').length / retries.length 
        : 0;
      
      trends.retrySuccess.push({
        date: dateStr,
        value: retrySuccess
      });
    }

    return trends;
  }

  private static calculateDistributions(testRuns: any[], flakyTests: any[], testResults: any[]) {
    // Test status distribution
    const passed = testResults.filter(t => t.status === 'passed').length;
    const failed = testResults.filter(t => t.status === 'failed').length;
    const skipped = testResults.filter(t => t.status === 'skipped').length;
    const total = testResults.length;

    const testsByStatus = [
      { status: 'passed', count: passed, percentage: total > 0 ? (passed / total) * 100 : 0 },
      { status: 'failed', count: failed, percentage: total > 0 ? (failed / total) * 100 : 0 },
      { status: 'skipped', count: skipped, percentage: total > 0 ? (skipped / total) * 100 : 0 }
    ];

    // Tests by suite
    const suiteStats = new Map<string, { total: number; flaky: number }>();
    
    testResults.forEach(test => {
      const suite = test.testSuite || 'default';
      if (!suiteStats.has(suite)) {
        suiteStats.set(suite, { total: 0, flaky: 0 });
      }
      suiteStats.get(suite)!.total++;
    });

    flakyTests.forEach(test => {
      const suite = test.testSuite || 'default';
      if (suiteStats.has(suite)) {
        suiteStats.get(suite)!.flaky++;
      }
    });

    const testsBySuite = Array.from(suiteStats.entries()).map(([suite, stats]) => ({
      suite,
      count: stats.total,
      flakyCount: stats.flaky
    }));

    // Failure patterns (mock data for now)
    const failuresByPattern = [
      { pattern: 'timing-sensitive', count: Math.floor(flakyTests.length * 0.4), description: 'Tests sensitive to timing and delays' },
      { pattern: 'environment-dependent', count: Math.floor(flakyTests.length * 0.3), description: 'Tests affected by environment differences' },
      { pattern: 'intermittent', count: Math.floor(flakyTests.length * 0.2), description: 'Randomly failing tests' },
      { pattern: 'unknown', count: Math.floor(flakyTests.length * 0.1), description: 'Unclassified failure patterns' }
    ];

    return {
      testsByStatus,
      testsBySuite,
      failuresByPattern
    };
  }

  private static generateInsights(flakyTests: any[], testResults: any[]) {
    // Most flaky tests
    const mostFlakyTests = flakyTests
      .slice(0, 10)
      .map(test => ({
        testName: test.testName,
        testSuite: test.testSuite,
        failureRate: test.failureRate,
        totalRuns: test.totalRuns,
        confidence: test.confidence
      }));

    // Slowest tests
    const testDurations = new Map<string, { total: number; count: number; max: number }>();
    
    testResults.forEach(test => {
      if (test.duration) {
        const key = `${test.testName}::${test.testSuite || 'default'}`;
        if (!testDurations.has(key)) {
          testDurations.set(key, { total: 0, count: 0, max: 0 });
        }
        const stats = testDurations.get(key)!;
        stats.total += test.duration;
        stats.count++;
        stats.max = Math.max(stats.max, test.duration);
      }
    });

    const slowestTests = Array.from(testDurations.entries())
      .map(([key, stats]) => {
        const [testName, testSuite] = key.split('::');
        return {
          testName,
          testSuite: testSuite === 'default' ? undefined : testSuite,
          averageDuration: stats.total / stats.count,
          maxDuration: stats.max
        };
      })
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 10);

    // Recently fixed (mock data)
    const recentlyFixed = flakyTests
      .filter(test => !test.isActive)
      .slice(0, 5)
      .map(test => ({
        testName: test.testName,
        testSuite: test.testSuite,
        fixedDate: test.updatedAt.toISOString().split('T')[0],
        daysFlaky: Math.floor(Math.random() * 30) + 1
      }));

    return {
      mostFlakyTests,
      slowestTests,
      recentlyFixed
    };
  }

  private static calculateHealthScore(overview: any, trends: any, flakyTests: any[]) {
    // Health scoring algorithm
    const stability = Math.max(0, 100 - (overview.flakyTests * 10)); // Penalize flaky tests
    const performance = overview.averageFailureRate < 0.05 ? 100 : Math.max(0, 100 - (overview.averageFailureRate * 1000));
    const coverage = overview.totalTests > 0 ? Math.min(100, overview.totalTests / 10) : 0;
    const maintenance = flakyTests.filter(t => t.confidence > 0.8).length === 0 ? 100 : 80;

    const score = (stability + performance + coverage + maintenance) / 4;

    const recommendations: string[] = [];
    if (stability < 80) recommendations.push('Address flaky tests to improve stability');
    if (performance < 80) recommendations.push('Investigate high failure rates');
    if (coverage < 50) recommendations.push('Increase test coverage');
    if (maintenance < 90) recommendations.push('Review high-confidence flaky tests');

    return {
      score: Math.round(score),
      factors: {
        stability: Math.round(stability),
        performance: Math.round(performance),
        coverage: Math.round(coverage),
        maintenance: Math.round(maintenance)
      },
      recommendations
    };
  }

  private static async getFailureRateTrend(projectId: string, cutoffDate: Date, period: string) {
    // Implementation for failure rate trend
    return [];
  }

  private static async getTestCountTrend(projectId: string, cutoffDate: Date, period: string) {
    // Implementation for test count trend
    return [];
  }

  private static async getFlakyTestsTrend(projectId: string, cutoffDate: Date, period: string) {
    // Implementation for flaky tests trend
    return [];
  }

  private static async getRetrySuccessTrend(projectId: string, cutoffDate: Date, period: string) {
    // Implementation for retry success trend
    return [];
  }

  private static analyzeTrendDirection(dataPoints: TimeSeriesData[]): 'improving' | 'declining' | 'stable' {
    if (dataPoints.length < 2) return 'stable';
    
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, dp) => sum + dp.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, dp) => sum + dp.value, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private static calculateChangePercentage(dataPoints: TimeSeriesData[]): number {
    if (dataPoints.length < 2) return 0;
    
    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }

  private static calculateSimpleHealthScore(testRuns: number, flakyTests: number): number {
    if (testRuns === 0) return 100;
    const flakyRatio = flakyTests / Math.max(testRuns, 1);
    return Math.max(0, Math.round(100 - (flakyRatio * 200)));
  }

  private static async getRecentActivity(userId: string) {
    const recentRuns = await prisma.testRun.findMany({
      where: {
        project: { userId }
      },
      include: {
        project: {
          select: { name: true }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    return recentRuns.map(run => ({
      projectId: run.projectId,
      projectName: run.project.name,
      event: `Test run ${run.status}`,
      timestamp: run.startedAt.toISOString()
    }));
  }
}