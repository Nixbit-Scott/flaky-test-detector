import { prisma } from './database.service';
import { FlakyTestDetectionService } from './flaky-test-detection.service';

export interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number; // seconds
  strategy: 'immediate' | 'linear' | 'exponential';
  onlyFlakyTests: boolean;
  confidenceThreshold: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
  retryAttempt: number;
  delaySeconds: number;
  confidence?: number;
}

export interface TestRetryRequest {
  projectId: string;
  testName: string;
  testSuite?: string;
  currentAttempt: number;
  lastFailureMessage?: string;
  buildId?: string;
}

export class RetryLogicService {
  private static defaultConfig: RetryConfig = {
    enabled: true,
    maxRetries: 3,
    retryDelay: 30,
    strategy: 'linear',
    onlyFlakyTests: true,
    confidenceThreshold: 0.6,
  };

  /**
   * Determine if a failed test should be retried
   */
  static async shouldRetryTest(request: TestRetryRequest): Promise<RetryDecision> {
    // Get project retry configuration
    const project = await prisma.project.findUnique({
      where: { id: request.projectId },
    });

    if (!project) {
      return {
        shouldRetry: false,
        reason: 'Project not found',
        retryAttempt: request.currentAttempt,
        delaySeconds: 0,
      };
    }

    const config: RetryConfig = {
      enabled: project.retryEnabled,
      maxRetries: project.maxRetries,
      retryDelay: project.retryDelay,
      strategy: 'linear', // Could be made configurable
      onlyFlakyTests: true, // Could be made configurable
      confidenceThreshold: this.defaultConfig.confidenceThreshold,
    };

    // Check if retries are disabled
    if (!config.enabled) {
      return {
        shouldRetry: false,
        reason: 'Retries disabled for this project',
        retryAttempt: request.currentAttempt,
        delaySeconds: 0,
      };
    }

    // Check if max retries exceeded
    if (request.currentAttempt >= config.maxRetries) {
      return {
        shouldRetry: false,
        reason: `Maximum retries (${config.maxRetries}) exceeded`,
        retryAttempt: request.currentAttempt,
        delaySeconds: 0,
      };
    }

    // If only retrying flaky tests, check if test is known to be flaky
    if (config.onlyFlakyTests) {
      const isFlaky = await FlakyTestDetectionService.isTestFlaky(
        request.projectId,
        request.testName,
        request.testSuite
      );

      if (!isFlaky) {
        return {
          shouldRetry: false,
          reason: 'Test is not identified as flaky',
          retryAttempt: request.currentAttempt,
          delaySeconds: 0,
        };
      }

      // Get confidence score for the flaky test
      const whereClause = {
        projectId: request.projectId,
        testName: request.testName,
        ...(request.testSuite ? { testSuite: request.testSuite } : { testSuite: null }),
      };

      const flakyPattern = await prisma.flakyTestPattern.findUnique({
        where: {
          projectId_testName_testSuite: whereClause as any,
        },
      });

      const confidence = flakyPattern?.confidence || 0;

      if (confidence < config.confidenceThreshold) {
        return {
          shouldRetry: false,
          reason: `Test flaky confidence (${Math.round(confidence * 100)}%) below threshold (${Math.round(config.confidenceThreshold * 100)}%)`,
          retryAttempt: request.currentAttempt,
          delaySeconds: 0,
          confidence,
        };
      }

      // Calculate delay based on strategy
      const delaySeconds = this.calculateRetryDelay(
        request.currentAttempt + 1,
        config.retryDelay,
        config.strategy
      );

      return {
        shouldRetry: true,
        reason: `Test is flaky (confidence: ${Math.round(confidence * 100)}%)`,
        retryAttempt: request.currentAttempt + 1,
        delaySeconds,
        confidence,
      };
    }

    // If not limiting to flaky tests, retry all failed tests
    const delaySeconds = this.calculateRetryDelay(
      request.currentAttempt + 1,
      config.retryDelay,
      config.strategy
    );

    return {
      shouldRetry: true,
      reason: 'Retrying failed test (all tests retry enabled)',
      retryAttempt: request.currentAttempt + 1,
      delaySeconds,
    };
  }

  /**
   * Process a batch of failed tests and determine retry strategy
   */
  static async processFailedTests(
    projectId: string,
    failedTests: { testName: string; testSuite?: string; errorMessage?: string }[],
    buildId?: string
  ): Promise<{ retryTests: TestRetryRequest[]; skipTests: TestRetryRequest[] }> {
    const retryTests: TestRetryRequest[] = [];
    const skipTests: TestRetryRequest[] = [];

    for (const test of failedTests) {
      const decision = await this.shouldRetryTest({
        projectId,
        testName: test.testName,
        testSuite: test.testSuite,
        currentAttempt: 0, // First retry attempt
        lastFailureMessage: test.errorMessage,
        buildId,
      });

      if (decision.shouldRetry) {
        retryTests.push({
          projectId,
          testName: test.testName,
          testSuite: test.testSuite,
          currentAttempt: decision.retryAttempt,
          lastFailureMessage: test.errorMessage,
          buildId,
        });
      } else {
        skipTests.push({
          projectId,
          testName: test.testName,
          testSuite: test.testSuite,
          currentAttempt: 0,
          lastFailureMessage: test.errorMessage,
          buildId,
        });
      }
    }

    return { retryTests, skipTests };
  }

  /**
   * Generate retry commands for CI/CD systems
   */
  static generateRetryCommands(
    retryTests: TestRetryRequest[],
    ciSystem: 'github' | 'gitlab' | 'jenkins' = 'github'
  ): { commands: string[]; delaySeconds: number } {
    if (retryTests.length === 0) {
      return { commands: [], delaySeconds: 0 };
    }

    // Find the maximum delay needed
    const maxDelay = Math.max(
      ...retryTests.map(test => 
        this.calculateRetryDelay(test.currentAttempt, 30, 'linear')
      )
    );

    const commands: string[] = [];

    switch (ciSystem) {
      case 'github':
        // GitHub Actions retry commands
        const testNames = retryTests.map(t => t.testName).join(' ');
        commands.push(`echo "Retrying ${retryTests.length} flaky tests..."`);
        commands.push(`sleep ${maxDelay}`);
        commands.push(`npm test -- --testNamePattern="${testNames}"`);
        break;

      case 'gitlab':
        // GitLab CI retry commands
        commands.push(`echo "Retrying ${retryTests.length} flaky tests..."`);
        commands.push(`sleep ${maxDelay}`);
        retryTests.forEach(test => {
          commands.push(`npm test -- --grep "${test.testName}"`);
        });
        break;

      case 'jenkins':
        // Jenkins retry commands
        commands.push(`echo "Retrying ${retryTests.length} flaky tests..."`);
        commands.push(`sleep ${maxDelay}`);
        commands.push(`./gradlew test --tests "${retryTests.map(t => t.testName).join('" --tests "')}"`);
        break;
    }

    return { commands, delaySeconds: maxDelay };
  }

  /**
   * Record retry attempt in database
   */
  static async recordRetryAttempt(
    projectId: string,
    testName: string,
    testSuite: string | undefined,
    retryAttempt: number,
    result: 'success' | 'failure',
    duration?: number,
    errorMessage?: string
  ): Promise<void> {
    // This would typically be called after a retry attempt
    // You might want to create a separate table for retry history
    try {
      await prisma.testResult.create({
        data: {
          testRunId: '', // Would need actual test run ID
          projectId: '', // Would need actual project ID
          testName,
          testSuite,
          status: result === 'success' ? 'passed' : 'failed',
          duration,
          errorMessage,
          retryAttempt,
        },
      });
    } catch (error) {
      console.error('Failed to record retry attempt:', error);
    }
  }

  /**
   * Get retry statistics for a project
   */
  static async getRetryStatistics(projectId: string, days = 30): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    retrySuccessRate: number;
    mostRetriedTests: Array<{ testName: string; testSuite?: string; retryCount: number }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const retryResults = await prisma.testResult.findMany({
      where: {
        testRun: {
          projectId,
          startedAt: {
            gte: cutoffDate,
          },
        },
        retryAttempt: {
          gt: 0,
        },
      },
      include: {
        testRun: true,
      },
    });

    const totalRetries = retryResults.length;
    const successfulRetries = retryResults.filter(r => r.status === 'passed').length;
    const failedRetries = totalRetries - successfulRetries;
    const retrySuccessRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;

    // Count retries per test
    const testRetryCount = new Map<string, number>();
    retryResults.forEach(result => {
      const key = `${result.testName}::${result.testSuite || ''}`;
      testRetryCount.set(key, (testRetryCount.get(key) || 0) + 1);
    });

    const mostRetriedTests = Array.from(testRetryCount.entries())
      .map(([key, count]) => {
        const [testName, testSuite] = key.split('::');
        return {
          testName,
          testSuite: testSuite || undefined,
          retryCount: count,
        };
      })
      .sort((a, b) => b.retryCount - a.retryCount)
      .slice(0, 10);

    return {
      totalRetries,
      successfulRetries,
      failedRetries,
      retrySuccessRate: Math.round(retrySuccessRate * 100) / 100,
      mostRetriedTests,
    };
  }

  /**
   * Calculate retry delay based on strategy
   */
  private static calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    strategy: 'immediate' | 'linear' | 'exponential'
  ): number {
    switch (strategy) {
      case 'immediate':
        return 0;
      case 'linear':
        return baseDelay * attempt;
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      default:
        return baseDelay;
    }
  }

  /**
   * Update project retry configuration
   */
  static async updateRetryConfig(
    projectId: string,
    config: Partial<Pick<RetryConfig, 'enabled' | 'maxRetries' | 'retryDelay'>>
  ): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        retryEnabled: config.enabled,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
      },
    });
  }
}