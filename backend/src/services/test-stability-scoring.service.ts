import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface StabilityScore {
  testId: string;
  testName: string;
  testSuite?: string;
  currentScore: number; // 0-100 stability score
  trend: 'improving' | 'degrading' | 'stable' | 'volatile';
  confidence: number; // 0-1 confidence in the score
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculated: Date;
}

export interface StabilityMetrics {
  successRate: number;
  failureRate: number;
  volatilityIndex: number; // How much the success rate varies
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  timeToStabilize: number; // Days to reach stable state
  recoveryTime: number; // Average time between failure and next success
}

export interface TrendAnalysis {
  period: 'daily' | 'weekly' | 'monthly';
  dataPoints: Array<{
    date: Date;
    score: number;
    successRate: number;
    runCount: number;
  }>;
  trendDirection: 'improving' | 'degrading' | 'stable';
  changeRate: number; // Points per day/week/month
  volatility: number; // Standard deviation of scores
  seasonality: {
    hasPattern: boolean;
    peakDays?: string[]; // Days of week with most failures
    peakHours?: number[]; // Hours with most failures
  };
}

export interface StabilityReport {
  projectId: string;
  generatedAt: Date;
  overallStability: number; // Project-wide stability score
  totalTests: number;
  stableTests: number;
  unstableTests: number;
  criticalTests: number;
  topUnstableTests: StabilityScore[];
  stabilityDistribution: Record<string, number>;
  trends: {
    daily: TrendAnalysis;
    weekly: TrendAnalysis;
    monthly: TrendAnalysis;
  };
  insights: string[];
  recommendations: string[];
}

export class TestStabilityScoringService {
  
  public async calculateStabilityScore(
    projectId: string,
    testName: string,
    testSuite?: string,
    windowDays: number = 30
  ): Promise<StabilityScore> {
    logger.info(`Calculating stability score for ${testName} in project ${projectId}`);

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    // Get test results for the specified window
    const testResults = await prisma.testResult.findMany({
      where: {
        projectId,
        testName,
        testSuite: testSuite || null,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' }
    });

    if (testResults.length === 0) {
      return this.getDefaultStabilityScore(testName, testSuite);
    }

    const metrics = this.calculateStabilityMetrics(testResults);
    const score = this.calculateScore(metrics, testResults.length);
    const trend = this.analyzeTrend(testResults);
    const confidence = this.calculateConfidence(testResults.length, windowDays);
    const riskLevel = this.determineRiskLevel(score, metrics);

    return {
      testId: `${testName}-${testSuite || 'default'}`,
      testName,
      testSuite,
      currentScore: Math.round(score * 100) / 100,
      trend,
      confidence: Math.round(confidence * 100) / 100,
      riskLevel,
      lastCalculated: new Date()
    };
  }

  public async calculateProjectStability(projectId: string): Promise<StabilityReport> {
    logger.info(`Calculating project stability for ${projectId}`);

    // Get all unique tests in the project
    const uniqueTests = await prisma.testResult.groupBy({
      by: ['testName', 'testSuite'],
      where: { projectId },
      _count: { id: true }
    });

    // Calculate stability scores for all tests
    const stabilityScores = await Promise.all(
      uniqueTests.map(test =>
        this.calculateStabilityScore(projectId, test.testName, test.testSuite || undefined)
      )
    );

    // Generate trend analyses
    const dailyTrend = await this.generateTrendAnalysis(projectId, 'daily', 30);
    const weeklyTrend = await this.generateTrendAnalysis(projectId, 'weekly', 12);
    const monthlyTrend = await this.generateTrendAnalysis(projectId, 'monthly', 6);

    // Calculate overall metrics
    const overallStability = this.calculateOverallStability(stabilityScores);
    const distribution = this.calculateStabilityDistribution(stabilityScores);
    const insights = this.generateInsights(stabilityScores, dailyTrend);
    const recommendations = this.generateRecommendations(stabilityScores, insights);

    // Categorize tests
    const stableTests = stabilityScores.filter(s => s.currentScore >= 80).length;
    const unstableTests = stabilityScores.filter(s => s.currentScore < 80 && s.currentScore >= 60).length;
    const criticalTests = stabilityScores.filter(s => s.currentScore < 60).length;

    return {
      projectId,
      generatedAt: new Date(),
      overallStability,
      totalTests: stabilityScores.length,
      stableTests,
      unstableTests,
      criticalTests,
      topUnstableTests: stabilityScores
        .filter(s => s.currentScore < 80)
        .sort((a, b) => a.currentScore - b.currentScore)
        .slice(0, 10),
      stabilityDistribution: distribution,
      trends: {
        daily: dailyTrend,
        weekly: weeklyTrend,
        monthly: monthlyTrend
      },
      insights,
      recommendations
    };
  }

  private calculateStabilityMetrics(testResults: any[]): StabilityMetrics {
    const totalRuns = testResults.length;
    const successfulRuns = testResults.filter(r => r.status === 'passed').length;
    const failedRuns = testResults.filter(r => r.status === 'failed').length;
    
    const successRate = successfulRuns / totalRuns;
    const failureRate = failedRuns / totalRuns;

    // Calculate volatility (how much success rate varies over time)
    const volatilityIndex = this.calculateVolatilityIndex(testResults);

    // Calculate consecutive streaks
    const { consecutiveFailures, consecutiveSuccesses } = this.calculateStreaks(testResults);

    // Calculate time metrics
    const timeToStabilize = this.calculateTimeToStabilize(testResults);
    const recoveryTime = this.calculateRecoveryTime(testResults);

    return {
      successRate,
      failureRate,
      volatilityIndex,
      consecutiveFailures,
      consecutiveSuccesses,
      timeToStabilize,
      recoveryTime
    };
  }

  private calculateVolatilityIndex(testResults: any[]): number {
    // Calculate success rate for each day and measure volatility
    const dailyRates = this.groupByDay(testResults)
      .map(dayResults => {
        const successes = dayResults.filter(r => r.status === 'passed').length;
        return successes / dayResults.length;
      });

    if (dailyRates.length < 2) return 0;

    const mean = dailyRates.reduce((sum, rate) => sum + rate, 0) / dailyRates.length;
    const variance = dailyRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / dailyRates.length;
    return Math.sqrt(variance);
  }

  private groupByDay(testResults: any[]): any[][] {
    const groups: Record<string, any[]> = {};
    
    testResults.forEach(result => {
      const day = new Date(result.timestamp).toDateString();
      if (!groups[day]) {
        groups[day] = [];
      }
      groups[day].push(result);
    });

    return Object.values(groups);
  }

  private calculateStreaks(testResults: any[]): { consecutiveFailures: number; consecutiveSuccesses: number } {
    let maxConsecutiveFailures = 0;
    let maxConsecutiveSuccesses = 0;
    let currentFailureStreak = 0;
    let currentSuccessStreak = 0;

    testResults.forEach(result => {
      if (result.status === 'failed') {
        currentFailureStreak++;
        currentSuccessStreak = 0;
        maxConsecutiveFailures = Math.max(maxConsecutiveFailures, currentFailureStreak);
      } else if (result.status === 'passed') {
        currentSuccessStreak++;
        currentFailureStreak = 0;
        maxConsecutiveSuccesses = Math.max(maxConsecutiveSuccesses, currentSuccessStreak);
      }
    });

    return {
      consecutiveFailures: maxConsecutiveFailures,
      consecutiveSuccesses: maxConsecutiveSuccesses
    };
  }

  private calculateTimeToStabilize(testResults: any[]): number {
    // Find the most recent period of stability (7+ consecutive successes)
    const stabilityThreshold = 7;
    let stabilityStart: Date | null = null;

    for (let i = testResults.length - 1; i >= stabilityThreshold - 1; i--) {
      const window = testResults.slice(i - stabilityThreshold + 1, i + 1);
      const allSuccessful = window.every(r => r.status === 'passed');
      
      if (allSuccessful) {
        stabilityStart = new Date(window[0].timestamp);
        break;
      }
    }

    if (!stabilityStart) return -1; // Not stable

    const now = new Date();
    return Math.floor((now.getTime() - stabilityStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateRecoveryTime(testResults: any[]): number {
    // Calculate average time between a failure and the next success
    const recoveryTimes: number[] = [];

    for (let i = 0; i < testResults.length - 1; i++) {
      if (testResults[i].status === 'failed') {
        // Find next success
        for (let j = i + 1; j < testResults.length; j++) {
          if (testResults[j].status === 'passed') {
            const recoveryTime = new Date(testResults[j].timestamp).getTime() - 
                               new Date(testResults[i].timestamp).getTime();
            recoveryTimes.push(recoveryTime / (1000 * 60 * 60)); // Convert to hours
            break;
          }
        }
      }
    }

    return recoveryTimes.length > 0 
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
      : 0;
  }

  private calculateScore(metrics: StabilityMetrics, sampleSize: number): number {
    let score = 100;

    // Base score from success rate (60% weight)
    score *= metrics.successRate;

    // Penalize volatility (20% weight)
    const volatilityPenalty = Math.min(metrics.volatilityIndex * 40, 30);
    score -= volatilityPenalty;

    // Penalize consecutive failures (15% weight)
    if (metrics.consecutiveFailures > 0) {
      const failurePenalty = Math.min(metrics.consecutiveFailures * 5, 15);
      score -= failurePenalty;
    }

    // Sample size adjustment (5% weight)
    if (sampleSize < 10) {
      score *= 0.9; // Reduce confidence for small samples
    }

    // Recovery time factor
    if (metrics.recoveryTime > 24) { // > 24 hours to recover
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private analyzeTrend(testResults: any[]): 'improving' | 'degrading' | 'stable' | 'volatile' {
    if (testResults.length < 10) return 'stable';

    // Split into early and recent halves
    const midPoint = Math.floor(testResults.length / 2);
    const earlyResults = testResults.slice(0, midPoint);
    const recentResults = testResults.slice(midPoint);

    const earlySuccessRate = earlyResults.filter(r => r.status === 'passed').length / earlyResults.length;
    const recentSuccessRate = recentResults.filter(r => r.status === 'passed').length / recentResults.length;

    const change = recentSuccessRate - earlySuccessRate;
    const volatility = this.calculateVolatilityIndex(testResults);

    if (volatility > 0.3) return 'volatile';
    if (change > 0.15) return 'improving';
    if (change < -0.15) return 'degrading';
    return 'stable';
  }

  private calculateConfidence(sampleSize: number, windowDays: number): number {
    // Confidence based on sample size and recency
    let confidence = Math.min(sampleSize / 50, 1.0); // More samples = higher confidence

    // Adjust for window size
    if (windowDays < 7) confidence *= 0.8; // Short window reduces confidence
    if (windowDays > 60) confidence *= 0.9; // Very long window may include outdated data

    return Math.max(0.1, confidence);
  }

  private determineRiskLevel(score: number, metrics: StabilityMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'low';
    if (score >= 75) return 'medium';
    if (score >= 50) return 'high';
    return 'critical';
  }

  private getDefaultStabilityScore(testName: string, testSuite?: string): StabilityScore {
    return {
      testId: `${testName}-${testSuite || 'default'}`,
      testName,
      testSuite,
      currentScore: 100, // Assume stable if no data
      trend: 'stable',
      confidence: 0.1, // Low confidence with no data
      riskLevel: 'low',
      lastCalculated: new Date()
    };
  }

  public async generateTrendAnalysis(
    projectId: string,
    period: 'daily' | 'weekly' | 'monthly',
    dataPoints: number
  ): Promise<TrendAnalysis> {
    const intervals = this.calculateIntervals(period, dataPoints);
    const trendData: Array<{ date: Date; score: number; successRate: number; runCount: number }> = [];

    for (const interval of intervals) {
      const testResults = await prisma.testResult.findMany({
        where: {
          projectId,
          timestamp: {
            gte: interval.start,
            lt: interval.end
          }
        }
      });

      const successRate = testResults.length > 0 
        ? testResults.filter(r => r.status === 'passed').length / testResults.length
        : 1.0;

      const score = successRate * 100; // Simplified score calculation

      trendData.push({
        date: interval.start,
        score,
        successRate,
        runCount: testResults.length
      });
    }

    const trendDirection = this.calculateTrendDirection(trendData);
    const changeRate = this.calculateChangeRate(trendData, period);
    const volatility = this.calculateTrendVolatility(trendData);
    const seasonality = await this.analyzeSeasonality(projectId, period);

    return {
      period,
      dataPoints: trendData,
      trendDirection,
      changeRate,
      volatility,
      seasonality
    };
  }

  private calculateIntervals(period: 'daily' | 'weekly' | 'monthly', count: number) {
    const intervals: Array<{ start: Date; end: Date }> = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(now);
      const start = new Date(now);

      if (period === 'daily') {
        start.setDate(now.getDate() - i);
        end.setDate(now.getDate() - i + 1);
      } else if (period === 'weekly') {
        start.setDate(now.getDate() - (i * 7));
        end.setDate(now.getDate() - (i * 7) + 7);
      } else { // monthly
        start.setMonth(now.getMonth() - i);
        end.setMonth(now.getMonth() - i + 1);
      }

      intervals.push({ start, end });
    }

    return intervals;
  }

  private calculateTrendDirection(trendData: any[]): 'improving' | 'degrading' | 'stable' {
    if (trendData.length < 3) return 'stable';

    const recent = trendData.slice(-3);
    const earlier = trendData.slice(0, 3);

    const recentAvg = recent.reduce((sum, d) => sum + d.score, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, d) => sum + d.score, 0) / earlier.length;

    const change = recentAvg - earlierAvg;

    if (change > 5) return 'improving';
    if (change < -5) return 'degrading';
    return 'stable';
  }

  private calculateChangeRate(trendData: any[], period: 'daily' | 'weekly' | 'monthly'): number {
    if (trendData.length < 2) return 0;

    const firstScore = trendData[0].score;
    const lastScore = trendData[trendData.length - 1].score;
    const totalChange = lastScore - firstScore;
    const periods = trendData.length - 1;

    return totalChange / periods;
  }

  private calculateTrendVolatility(trendData: any[]): number {
    if (trendData.length < 2) return 0;

    const scores = trendData.map(d => d.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    
    return Math.sqrt(variance);
  }

  private async analyzeSeasonality(projectId: string, period: string) {
    // Analyze if there are patterns by day of week or hour of day
    const testResults = await prisma.testResult.findMany({
      where: {
        projectId,
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const dayPatterns: Record<string, { total: number; failures: number }> = {};
    const hourPatterns: Record<number, { total: number; failures: number }> = {};

    testResults.forEach(result => {
      const date = new Date(result.timestamp);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = date.getHours();

      // Track day patterns
      if (!dayPatterns[dayOfWeek]) {
        dayPatterns[dayOfWeek] = { total: 0, failures: 0 };
      }
      dayPatterns[dayOfWeek].total++;
      if (result.status === 'failed') {
        dayPatterns[dayOfWeek].failures++;
      }

      // Track hour patterns
      if (!hourPatterns[hour]) {
        hourPatterns[hour] = { total: 0, failures: 0 };
      }
      hourPatterns[hour].total++;
      if (result.status === 'failed') {
        hourPatterns[hour].failures++;
      }
    });

    // Find peak failure days and hours
    const dayFailureRates = Object.entries(dayPatterns).map(([day, stats]) => ({
      day,
      failureRate: stats.failures / stats.total
    }));

    const hourFailureRates = Object.entries(hourPatterns).map(([hour, stats]) => ({
      hour: parseInt(hour),
      failureRate: stats.failures / stats.total
    }));

    const avgDayFailureRate = dayFailureRates.reduce((sum, d) => sum + d.failureRate, 0) / dayFailureRates.length;
    const avgHourFailureRate = hourFailureRates.reduce((sum, h) => sum + h.failureRate, 0) / hourFailureRates.length;

    const peakDays = dayFailureRates
      .filter(d => d.failureRate > avgDayFailureRate * 1.5)
      .map(d => d.day);

    const peakHours = hourFailureRates
      .filter(h => h.failureRate > avgHourFailureRate * 1.5)
      .map(h => h.hour);

    return {
      hasPattern: peakDays.length > 0 || peakHours.length > 0,
      peakDays: peakDays.length > 0 ? peakDays : undefined,
      peakHours: peakHours.length > 0 ? peakHours : undefined
    };
  }

  private calculateOverallStability(scores: StabilityScore[]): number {
    if (scores.length === 0) return 100;

    // Weighted average based on confidence
    const totalWeight = scores.reduce((sum, score) => sum + score.confidence, 0);
    const weightedSum = scores.reduce((sum, score) => sum + (score.currentScore * score.confidence), 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 100;
  }

  private calculateStabilityDistribution(scores: StabilityScore[]): Record<string, number> {
    const distribution = {
      excellent: 0, // 90-100
      good: 0,      // 75-89
      fair: 0,      // 60-74
      poor: 0,      // 40-59
      critical: 0   // 0-39
    };

    scores.forEach(score => {
      if (score.currentScore >= 90) distribution.excellent++;
      else if (score.currentScore >= 75) distribution.good++;
      else if (score.currentScore >= 60) distribution.fair++;
      else if (score.currentScore >= 40) distribution.poor++;
      else distribution.critical++;
    });

    return distribution;
  }

  private generateInsights(scores: StabilityScore[], dailyTrend: TrendAnalysis): string[] {
    const insights: string[] = [];

    // Overall health insight
    const avgScore = scores.reduce((sum, s) => sum + s.currentScore, 0) / scores.length;
    if (avgScore >= 85) {
      insights.push('🟢 Overall test stability is excellent');
    } else if (avgScore >= 70) {
      insights.push('🟡 Test stability is good but has room for improvement');
    } else {
      insights.push('🔴 Test stability needs immediate attention');
    }

    // Trend insight
    if (dailyTrend.trendDirection === 'improving') {
      insights.push('📈 Test stability is improving over time');
    } else if (dailyTrend.trendDirection === 'degrading') {
      insights.push('📉 Test stability is degrading - investigate recent changes');
    }

    // Volatility insight
    if (dailyTrend.volatility > 15) {
      insights.push('⚠️ High volatility detected - tests are inconsistent');
    }

    // Critical tests insight
    const criticalTests = scores.filter(s => s.riskLevel === 'critical').length;
    if (criticalTests > 0) {
      insights.push(`🚨 ${criticalTests} tests require immediate attention`);
    }

    // Seasonality insights
    if (dailyTrend.seasonality.hasPattern) {
      if (dailyTrend.seasonality.peakDays) {
        insights.push(`📅 Higher failure rates detected on ${dailyTrend.seasonality.peakDays.join(', ')}`);
      }
      if (dailyTrend.seasonality.peakHours) {
        insights.push(`🕐 Higher failure rates during hours ${dailyTrend.seasonality.peakHours.join(', ')}`);
      }
    }

    return insights;
  }

  private generateRecommendations(scores: StabilityScore[], insights: string[]): string[] {
    const recommendations: string[] = [];

    // Focus on critical tests
    const criticalTests = scores.filter(s => s.riskLevel === 'critical');
    if (criticalTests.length > 0) {
      recommendations.push(`Priority: Stabilize ${criticalTests.length} critical tests starting with lowest scores`);
    }

    // Address volatile tests
    const volatileTests = scores.filter(s => s.trend === 'volatile');
    if (volatileTests.length > 0) {
      recommendations.push(`Investigate ${volatileTests.length} volatile tests for intermittent issues`);
    }

    // Trend-based recommendations
    const degradingTests = scores.filter(s => s.trend === 'degrading');
    if (degradingTests.length > 0) {
      recommendations.push(`Review recent changes affecting ${degradingTests.length} degrading tests`);
    }

    // General recommendations based on insights
    if (insights.some(i => i.includes('volatility'))) {
      recommendations.push('Consider implementing test isolation and cleanup procedures');
    }

    if (insights.some(i => i.includes('seasonality'))) {
      recommendations.push('Investigate infrastructure or load patterns causing time-based failures');
    }

    return recommendations;
  }

  public async storeStabilityReport(report: StabilityReport): Promise<void> {
    try {
      await prisma.stabilityReport.create({
        data: {
          projectId: report.projectId,
          generatedAt: report.generatedAt,
          overallStability: report.overallStability,
          totalTests: report.totalTests,
          stableTests: report.stableTests,
          unstableTests: report.unstableTests,
          criticalTests: report.criticalTests,
          reportData: report as any, // Store full report as JSON
          insights: report.insights,
          recommendations: report.recommendations
        }
      });

      logger.info(`Stored stability report for project ${report.projectId}: ${Math.round(report.overallStability)}% stable`);
    } catch (error) {
      logger.error('Error storing stability report:', error);
    }
  }
}